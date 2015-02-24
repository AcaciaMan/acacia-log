/*
 * Copyright 2015 Acacia Man
 * The program is distributed under the terms of the GNU General Public License
 * 
 * This file is part of acacia-log.
 *
 * acacia-log is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * acacia-log is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with acacia-log.  If not, see <http://www.gnu.org/licenses/>.
 */
package loganalysis;

import acacialog.IniFile;
import acacialog.PropertiesList;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.TreeSet;
import java.util.regex.Pattern;

public class LogConfig {

    private String logName;
    private Path dirPath;
    private String filePattern;
    private String dateFormat;
    private Pattern datePattern;
    private String zonedDateTime;
    private char[] zonedCharArray;
    private TreeSet<LogFile> logFiles = new TreeSet<>();

    public LogConfig(String section, IniFile iniFile) {
        this.logName = section;
        this.dirPath = Paths.get(iniFile.getString(section, PropertiesList.DIR.
                name(), null));
        this.filePattern = iniFile.
                getString(section, PropertiesList.FILE.name(), null);
        this.setDateFormat(iniFile.
                getString(section, PropertiesList.DATE.name(), null));
        this.setZonedDateTime(iniFile.getString(section,
                PropertiesList.ZONED_DATE_TIME.name(), null));
    }

    /**
     * @return the logName
     */
    public String getLogName() {
        return logName;
    }

    /**
     * @param logName the logName to set
     */
    public void setLogName(String logName) {
        this.logName = logName;
    }

    /**
     * @return the dirPath
     */
    public Path getDirPath() {
        return dirPath;
    }

    /**
     * @param dirPath the dirPath to set
     */
    public void setDirPath(Path dirPath) {
        this.dirPath = dirPath;
    }

    /**
     * @return the filePattern
     */
    public String getFilePattern() {
        return filePattern;
    }

    /**
     * @param filePattern the filePattern to set
     */
    public void setFilePattern(String filePattern) {
        this.filePattern = filePattern;
    }

    /**
     * @return the dateFormat
     */
    public String getDateFormat() {
        return dateFormat;
    }

    /**
     * @param dateFormat the dateFormat to set
     */
    public void setDateFormat(String dateFormat) {
        this.dateFormat = dateFormat;
        this.datePattern = Pattern.compile(dateFormat);
    }

    public Pattern getDatePattern() {
        return datePattern;
    }

    /**
     * @return the zonedDateTime
     */
    public String getZonedDateTime() {
        return zonedDateTime;
    }

    /**
     * @param zonedDateTime the zonedDateTime to set
     */
    public void setZonedDateTime(String zonedDateTime) {
        this.zonedDateTime = zonedDateTime;
        this.zonedCharArray = zonedDateTime.toCharArray();
    }

    /**
     * @return the zonedCharArray
     */
    public char[] getZonedCharArray() {
        return zonedCharArray;
    }

    /**
     * @return the logFiles
     */
    public TreeSet<LogFile> getLogFiles() {
        return logFiles;
    }

    /**
     * @param logFiles the logFiles to set
     */
    public void setLogFiles(TreeSet<LogFile> logFiles) {
        this.logFiles = logFiles;
    }

    public void printSection() {
        System.out.print(getLogName() + " ");

        if (logFiles.isEmpty()) {
            System.out.println("NO_FILES_IN_INTERVAL");
        } else if (logFiles.size() == 1) {
            System.out.println(logFiles.first().getPath().getFileName());
        } else {
            System.out.println(
                    logFiles.first().getPath().getFileName() + " ... " + logFiles.
                    last().getPath().getFileName());
        }
    }

}
