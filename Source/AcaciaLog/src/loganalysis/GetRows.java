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
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

public class GetRows {

    Application app = (new ApplicationFactory()).getInstance();

    public void getInterval() {
        for (String s : app.iniFile.getSections()) {
            LogConfig lc = app.logs.get(s);
            ListFiles listFiles = new ListFiles();
            TreeSet<LogFile> lfts = listFiles.getIntervalFiles(lc);

            //<editor-fold defaultstate="collapsed" desc="print interval files">
            System.out.print(lc.getLogName() + " ");
            
            if (lfts.isEmpty()) {
                System.out.println("NO_FILES_IN_INTERVAL");
                continue;
            } else if (lfts.size() == 1) {
                System.out.println(lfts.first().getPath().getFileName());
            } else {
                System.out.println(
                        lfts.first().getPath().getFileName() + " ... " + lfts.
                                last().getPath().getFileName());
            }
//</editor-fold>
            
            
            List<LogFile> arr = new ArrayList<>();
            for(LogFile lf:lfts) {            
                 arr.add(lf);
            }
            
            for (int i = 0; i < arr.size(); i++) {
                LogFile lf = arr.get(i);
                LogFile lfNext = null;
                if (i+1< arr.size()) {
                    lfNext = arr.get(i+1);
                }
                lf.printInterval(lfNext);
                
            }
        }
    }

}
