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

import java.nio.file.Paths;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import loganalysis.LogConfig;

/**
 * Application class pointing to its properties file acacialog.properties
 */
public class Application {
    public Application() {
        super();
    }

  public PropertiesManager propsMg;
  public FileTime propsLastModified;
  public IniFile iniFile;
  public Map<String,LogConfig> logs = new HashMap<>();
  
  public ParseCmdLine cmd = new ParseCmdLine();

  public void setProperties(Properties props) {
      this.propsMg.props = props;
  }

  public Properties getProperties() {
      return this.propsMg.props;
  }
  
  public void load() {
      for(String s:iniFile.getSections()) {
          LogConfig lc = new LogConfig(s, iniFile);
          logs.put(s, lc);
      }  

  }
  
  public Instant getFrom() {
      return ZonedDateTime.parse( cmd.getFrom() ).toInstant();
  }

  public Instant getTo() {
      return ZonedDateTime.parse( cmd.getTo() ).toInstant();
  }

}