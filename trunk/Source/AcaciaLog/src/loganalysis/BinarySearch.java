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
import java.io.IOException;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.Scanner;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.MatchResult;

public class BinarySearch {

    Application app = (new ApplicationFactory()).getInstance();
    private Scanner scanner = null;

    public long getPositionFrom(LogFile lf) {
        long res = 0;

//<editor-fold defaultstate="collapsed" desc="check input parameters">
        if (lf.getFrom().isAfter(app.getFrom()) || lf.getFrom().equals(app.getFrom())) {
            return 0;
        }
//</editor-fold>

        res = searchPosition(lf, app.getFrom(), 0, lf.getFileSize());

        return res;
    }

    public long getPositionTo(long positionFrom, LogFile lf, LogFile lfNext) {
        long res = lf.getFileSize();

//<editor-fold defaultstate="collapsed" desc="check input parameters">
        if (lfNext!=null && app.getTo().isAfter(lfNext.getFrom())) {
            return lf.getFileSize();
        }
//</editor-fold>

        res = searchPosition(lf, app.getTo(), positionFrom, lf.getFileSize());

        return res;
    
    }

    /**
     * @return the scanner
     */
    public Scanner getScanner() {
        return scanner;
    }

    /**
     * @param scanner the scanner to set
     */
    public void setScanner(Scanner scanner) {
        this.scanner = scanner;
    }

    public Instant getZonedDateTime(long positionFrom, LogFile lf) {

        Instant res = null;
        try {
            lf.getFc().position(positionFrom);
            scanner = new Scanner(lf.getFc());
            if (scanner.findWithinHorizon(lf.getLc().getDatePattern(), 0) != null) {
                CharSequence cs = getZonedDateTime(scanner.match(), lf);
                ZonedDateTime zdt = ZonedDateTime.parse(cs);
                if (zdt != null) {
                    res = zdt.toInstant();
                }
            }
        } catch (IOException ex) {
            Logger.getLogger(BinarySearch.class.getName()).
                    log(Level.SEVERE, null, ex);
        } catch (Exception ex) {
            Logger.getLogger(BinarySearch.class.getName()).
                    log(Level.SEVERE, null, ex);
        }

        return res;

    }

    public CharSequence getZonedDateTime(MatchResult matcher, LogFile lf) {
        StringBuilder sb = new StringBuilder();
        char[] zonedArray = lf.getLc().getZonedCharArray();

        for (int i = 0, n = zonedArray.length; i < n; i++) {
            char c = zonedArray[i];
            if (c == 'g') {
                i++;
                int num = zonedArray[i] - 48;
                sb.append(matcher.group(num));
            } else {
                sb.append(c);
            }

        }

        return sb;
    }

    public long searchPosition(LogFile lf, Instant inst, long from, long to) {

        long imin = from;
        long imax = to;
        
        if(inst==null) return imax;

        while (imin < imax) {
            long imid = (imin + imax) / 2;

            // reduce the search
            Instant instMid = getZonedDateTime(imid, lf);
            if (instMid !=null && instMid.isBefore(inst)) {
                imin = imid + 1;
            } else {
                imax = imid;
            }
        }
        
        Instant instFind = getZonedDateTime(imin, lf);
        if(null!=instFind) {
            imin = imin + scanner.match().start();
        } else {
            imin = to;
        }
            

        return imin;

    }

}
