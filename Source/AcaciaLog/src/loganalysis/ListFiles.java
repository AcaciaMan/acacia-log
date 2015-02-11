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

import acacialog.Application;
import acacialog.ApplicationFactory;
import acacialog.PropertiesList;
import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;

public class ListFiles {

    Application app = (new ApplicationFactory()).getInstance();

    public Set<Path> listFiles(LogConfig lc) {
        Set<Path> result = new HashSet<>();

        try (DirectoryStream<Path> stream
                = Files.newDirectoryStream(lc.getDirPath(), lc.
                        getFilePattern())) {
            for (Path entry : stream) {
                result.add(entry);
            }
        } catch (IOException x) {
            // IOException can never be thrown by the iteration.
            // In this snippet, it can // only be thrown by newDirectoryStream.
            System.err.println(lc.getLogName() + " " + x);
        }

        return result;
    }

    public void listLastFiles() {
        // go through log configs
        // go through directory with glob pattern
        // find files and sout last found file
        // section + last modified time + file path
        // else not found dir, not found file
        for (String s : app.iniFile.getSections()) {
            LogConfig lc = app.logs.get(s);

            Path lastModified = null;
            try {
                for (Path entry : listFiles(lc)) {
                    //System.out.println(entry.getFileName());
                    if (lastModified == null) {
                        lastModified = entry;
                    } else if (Files.getLastModifiedTime(lastModified).
                            compareTo(Files.getLastModifiedTime(entry)) < 0) {
                        lastModified = entry;
                    } else if (Files.getLastModifiedTime(lastModified).
                            compareTo(Files.getLastModifiedTime(entry)) == 0) {
                        if (lastModified.compareTo(entry) < 0) {
                            lastModified = entry;
                        }
                    }

                }

                if (lastModified != null) {
                    Instant instant = Files.getLastModifiedTime(lastModified).
                            toInstant();
                    String format = DateTimeFormatter.ofPattern(app.
                            getProperties().getProperty(
                                    PropertiesList.OUTPUT_DATE_FORMAT.name())).
                            withZone(ZoneId.systemDefault()).format(instant);
                    System.out.println(s + " " + format + " " + lastModified.
                            getFileName() + " " + lastModified.getParent().
                            toString());
                } else {
                    System.out.println(s + " NO_LOG_FILE_FOUND " + lc.
                            getFilePattern());
                }

            } catch (IOException x) {
                // IOException can never be thrown by the iteration.
                // In this snippet, it can // only be thrown by newDirectoryStream.
                System.err.println(lc.getLogName() + " " + x);
            }

        }

    }

    public TreeSet<LogFile> getIntervalFiles(LogConfig lc) {
        TreeSet<LogFile> lfts = new TreeSet<>();

        for (Path entry : listFiles(lc)) {
            LogFile lf = new LogFile(entry, lc);
            lfts.add(lf);
        }
        
        for(LogFile lf:lfts) {
            if(!lf.containsInterval()) {
                lfts.remove(lf);
            }
                
        }
        
        return lfts;
    }

}
