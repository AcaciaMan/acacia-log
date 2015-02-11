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
package acacialog;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * ApplicationFactory class containing Map of application configurations
 */
public class ApplicationFactory {
    
    public static final Map<String,Application> apps = new ConcurrentHashMap<>();
    
    public ApplicationFactory() {
        super();
    }
    
    // This should be overriden in Factory subclasses
    protected Application getNewApplication() {
      return new Application();
    }
    
    protected Application initApplication() {
      Application app = getNewApplication();
      app.propsMg = new PropertiesManager();
      app.propsMg.load();
        try {
            app.propsLastModified = Files.getLastModifiedTime(app.propsMg.getPath());
            app.iniFile = new IniFile(app.getProperties().getProperty(PropertiesList.INI_FILE.name()));

        } catch (IOException ex) {
            Logger.getLogger(ApplicationFactory.class.getName()).log(Level.SEVERE, null, ex);
        }

      app.load();
        
      return app;
    }
    
    public Application getInstance(){
      Application app = null;
      PropertiesManager pm = new PropertiesManager();
        try {
            Path check = pm.getPath().toRealPath();
        } catch (IOException ex) {
            System.out.println("New resource file created!");
            pm.store();
            System.out.println("Path: " + pm.getPath().toString());
        }
     
      if(apps.containsKey(pm.getPath().toString())) {
        app = apps.get(pm.getPath().toString());

          try {
              // check if properties file is changed
              if(!app.propsLastModified.equals(Files.getLastModifiedTime(pm.getPath()))) {
                  apps.remove(pm.getPath().toString());
              } } catch (IOException ex) {
              Logger.getLogger(ApplicationFactory.class.getName()).log(Level.SEVERE, null, ex);
          }
      } 
      
      if(!apps.containsKey(pm.getPath().toString())) {
          // initialize application
          app = initApplication();
          apps.put(pm.getPath().toString(), app);
      }
      
            
      return app;
      
    }
    
    
}