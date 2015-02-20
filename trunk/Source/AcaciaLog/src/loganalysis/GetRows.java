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
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.PriorityQueue;
import java.util.TreeSet;

public class GetRows {

    Application app = (new ApplicationFactory()).getInstance();

    public void findInterval() {
        for (int j = 0; j < app.getSections().size(); j++) {
            String s = app.getSections().get(j);
            LogConfig lc = app.logs.get(s);
            ListFiles listFiles = new ListFiles();
            lc.setLogFiles(listFiles.getIntervalFiles(lc, j));

            TreeSet<LogFile> lfts = lc.getLogFiles();

            List<LogFile> arr = new ArrayList<>();
            for (LogFile lf : lfts) {
                arr.add(lf);
            }

            for (int i = 0; i < arr.size(); i++) {
                LogFile lf = arr.get(i);
                LogFile lfNext = null;
                if (i + 1 < arr.size()) {
                    lfNext = arr.get(i + 1);
                }
                lf.findInterval(lfNext);

            }
        }
    }

    public void printInterval() {

        for (String s : app.getSections()) {
            LogConfig lc = app.logs.get(s);
            TreeSet<LogFile> lfts = lc.getLogFiles();

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

            for (LogFile lf : lfts) {
                lf.printInterval(lf.getPositionFrom(), lf.getPositionTo());
            }
        }

    }

    public void findLogRecords() {

        for (int i = 0; i < app.getSections().size(); i++) {
            String s = app.getSections().get(i);
            LogConfig lc = app.logs.get(s);
            TreeSet<LogFile> lfts = lc.getLogFiles();

            for (LogFile lf : lfts) {
                lf.findRecords();
            }

        }

    }

    public void printLongestOperations() {
        int top = app.cmd.getTop();

        PriorityQueue<LogRecord> longest = new PriorityQueue<>(top,
                (LogRecord record1, LogRecord record2) -> record1.getDuration().
                compareTo(record2.getDuration()));

        for (String s : app.getSections()) {
            LogConfig lc = app.logs.get(s);
            TreeSet<LogFile> lfts = lc.getLogFiles();
            for (LogFile lf : lfts) {
                //go through log records and add to the Priority Queue
                LogRecord prev = null;
                for (LogRecord lr : lf.getRecords()) {
                    if (prev != null) {
                        lr.setDuration(Duration.between(prev.getInstant(), lr.
                                getInstant()));
                    } else {
                        lr.setDuration(Duration.between(lr.getInstant(), lr.
                                getInstant()));
                    }

                    if (longest.size() < top) {
                        longest.add(lr);
                    } else {
                        if (longest.peek().getDuration().compareTo(lr.
                                getDuration()) < 0) {
                            longest.poll();
                            longest.add(lr);
                        }
                    }

                    prev = lr;
                }
            }
        }

        /*while (longest.size() != 0)
         {
         System.out.println(longest.remove().getDuration().toString());
         }*/
        LogRecord[] lrs = longest.toArray(new LogRecord[longest.size()]);
        //System.out.println("size " + lrs.length);

        Arrays.sort(lrs, (LogRecord record1, LogRecord record2) -> record2.
                getDuration().
                compareTo(record1.getDuration()));

        for (LogRecord lr : lrs) {
            LogFile lf = lr.getLf();
            System.out.print(lr.getDuration().toString() + " " + lf.
                    getLc().getLogName() + " ");
            lf.printInterval(lf.getPositionFrom() + lr.getPositionFrom(), lf.
                    getPositionFrom() + lr.getPositionTo());
            System.out.println("");
        }

        if (lrs.length == 0) {
            System.out.println("NO_LOG_RECORDS_FOUND");
        }

    }

}
