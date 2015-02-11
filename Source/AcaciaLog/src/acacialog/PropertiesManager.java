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
import java.nio.file.Paths;

import java.util.Properties;

public class PropertiesManager {

    public static final String PROP_FILE = "acacialog.properties";
    
    Path path = Paths.get(PROP_FILE).toAbsolutePath();

    public Properties props;

    public PropertiesManager() {
        super();
    }
    
    public Path getPath() {
        return path;
    }

    public void load() {
        props = new Properties();

        try {
            
            //load a properties file
            props.load(Files.newBufferedReader(getPath()));
        } catch (IOException ex) {
            ex.printStackTrace();
            store();
        }

    }

    public void store() {
        props = new Properties();
        try {

            //save properties to project root folder
            props.store(Files.newBufferedWriter(getPath()), " -- Store properties --- ");

        } catch (IOException ex) {
            ex.printStackTrace();
        }
    }

}