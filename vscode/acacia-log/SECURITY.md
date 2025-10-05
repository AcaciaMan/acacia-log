# Security Policy

## Overview
This document outlines the security measures implemented in the Acacia Log extension and the status of known vulnerabilities.

**Last Updated**: October 6, 2025  
**Current Version**: 3.0.0

---

## Recent Security Updates

### ✅ Fixed - October 6, 2025
**brace-expansion Regular Expression Denial of Service (ReDoS)**
- **Vulnerability**: GHSA-v6h2-p8h4-qcjw
- **Affected Versions**: brace-expansion 1.0.0 - 1.1.11, 2.0.0 - 2.0.1
- **Fix Applied**: Updated to brace-expansion 1.1.12 and 2.0.2 via `npm audit fix`
- **Impact**: Low - this is a dev/test dependency with no runtime exposure
- **Status**: RESOLVED ✅

### ✅ Not Applicable - Documented
**@babel/helpers RegExp Complexity**
- **Vulnerability**: GHSA-968p-4wvh-cqc8
- **Status**: Not applicable - extension uses esbuild, not Babel
- **Mitigation**: Performance optimizations applied independently

**@eslint/plugin-kit ReDoS**
- **Vulnerability**: GHSA-xffm-g5w8-qvg7
- **Fix Applied**: Updated via `npm audit fix`
- **Status**: RESOLVED ✅

---

## esbuild Development Server Vulnerability

### The Issue
esbuild's built-in development server (when using `serve` mode) has a known security vulnerability:
- **CVE Reference**: esbuild serve mode CORS vulnerability
- **Impact**: Any website can send requests to the development server and read responses
- **Risk Level**: HIGH (for web applications)
- **Risk Level for this Extension**: LOW (not applicable - we don't use serve mode)

### Technical Details
When esbuild's `serve` option is enabled, it starts an HTTP server that:
1. Doesn't enforce proper CORS (Cross-Origin Resource Sharing) policies
2. Allows any origin to make requests
3. Permits reading responses from arbitrary origins
4. Could expose source code, build artifacts, or local files

Example of vulnerable configuration (NOT USED):
```javascript
// ❌ VULNERABLE - DO NOT USE
await esbuild.context({
  // ... config
  serve: {
    port: 8000,
    host: 'localhost'
  }
});
```

---

## Our Security Posture

### ✅ Safe Configuration
This VS Code extension uses esbuild **only for bundling**, not for serving:

```javascript
// ✅ SECURE - Current configuration
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  platform: 'node',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  // NO serve option = NO vulnerability
});

if (watch) {
  await ctx.watch(); // Only watches for file changes
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
```

### Why We're Safe

1. **No HTTP Server**: We never call `ctx.serve()` or use the `serve` option
2. **File System Only**: esbuild only writes to the file system (`dist/extension.js`)
3. **VS Code Integration**: The extension runs in VS Code's isolated extension host
4. **No Network Exposure**: No ports are opened, no HTTP endpoints created
5. **Watch Mode Only**: Uses file watcher for development, not HTTP server

---

## Security Best Practices

### For This Extension

✅ **DO:**
- Use `esbuild.context()` with `watch()` for development
- Bundle to file system with `outfile` option
- Keep esbuild updated to latest version
- Use `platform: 'node'` for VS Code extensions
- Document security considerations

❌ **DON'T:**
- Never enable `serve` option
- Never use `ctx.serve()`
- Don't expose build output via HTTP
- Avoid running esbuild as a web server

### Configuration Checklist

- [x] No `serve` option in esbuild config
- [x] No `ctx.serve()` calls in code
- [x] Uses `watch()` instead of HTTP server
- [x] Outputs to file system only
- [x] Security comments in configuration
- [x] Documentation of security posture

---

## VS Code Extension Security

### Additional Security Layers

VS Code extensions have built-in security:

1. **Sandboxing**: Extensions run in isolated extension host process
2. **Permissions**: Limited API access, no arbitrary file system access
3. **Review Process**: VS Code Marketplace reviews extensions
4. **User Consent**: Users explicitly install and enable extensions
5. **Update Control**: Users control when extensions update

### Extension-Specific Security

Our extension:
- ✅ No network requests to external servers
- ✅ No dynamic code execution
- ✅ Only reads log files user explicitly opens
- ✅ Doesn't modify system files
- ✅ Doesn't access sensitive data
- ✅ All HTML/JavaScript in webviews is static

---

## Monitoring & Updates

### Dependency Security

Regular checks for vulnerabilities:

```bash
# Check for security issues
npm audit

# Fix automatically where possible
npm audit fix

# Check for outdated packages
npm outdated

# Update esbuild to latest
npm update esbuild
```

### Current Dependencies Status

| Package | Version | Risk | Notes |
|---------|---------|------|-------|
| esbuild | ^0.24.0 | ✅ Low | Serve mode not used |
| luxon | ^3.5.0 | ✅ Low | Date library only |
| Chart.js | CDN | ✅ Low | Loaded from trusted CDN |

---

## Vulnerability Response Plan

If a security issue is discovered:

1. **Assessment**: Determine if vulnerability affects our usage
2. **Impact Analysis**: Check if we use affected features
3. **Mitigation**: Update dependencies or change configuration
4. **Testing**: Verify fix doesn't break functionality
5. **Release**: Publish updated extension version
6. **Communication**: Update changelog and notify users if critical

---

## Related Security Considerations

### Webview Security

This extension uses VS Code webviews, which have their own security:

```javascript
webviewView.webview.options = {
  enableScripts: true,          // Required for Chart.js
  localResourceRoots: [         // Restricts file access
    this.context.extensionUri
  ]
};
```

**Security measures:**
- ✅ Scripts only from trusted CDNs (Chart.js)
- ✅ No eval() or dynamic code execution
- ✅ Content Security Policy enforced by VS Code
- ✅ Sanitized user input in HTML generation
- ✅ No external image/resource loading (except CDN)

### Log File Processing

**Security measures:**
- ✅ Only processes files user explicitly opens
- ✅ No arbitrary file system access
- ✅ Regex patterns are user-provided but executed safely
- ✅ No command execution or shell access
- ✅ All file operations are read-only (except results.json)

---

## References

### Documentation
- [esbuild API Documentation](https://esbuild.github.io/api/)
- [VS Code Extension Security](https://code.visualstudio.com/api/extension-guides/webview#security)
- [npm audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)

### Security Advisories
- Check [GitHub Security Advisories](https://github.com/advisories) for esbuild
- Monitor [npm Security Advisories](https://www.npmjs.com/advisories)

### Best Practices
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## Conclusion

**This extension is NOT vulnerable** to the esbuild development server CORS issue because:

1. ✅ We don't use esbuild's serve mode
2. ✅ No HTTP server is started
3. ✅ No network exposure
4. ✅ File system bundling only
5. ✅ VS Code's additional security layers

The configuration has been documented with security comments to ensure future maintainers understand these considerations.

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-06 | 3.0.0 | Added security documentation and comments |

---

*For security concerns or to report vulnerabilities, please open an issue on [GitHub](https://github.com/AcaciaMan/acacia-log/issues) with the label "security".*
