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
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.channels.WritableByteChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.logging.Level;
import java.util.logging.Logger;

public class LogFile implements Comparable<LogFile> {

    Application app = (new ApplicationFactory()).getInstance();

    private Instant from = ZonedDateTime.now().toInstant();
    private Path path;
    private LogConfig lc;
    private long fileSize;
    private FileChannel fc;

    public LogFile(Path path, LogConfig lc) {
        this.path = path;
        this.lc = lc;
        from = getFirstTime();
    }

    public boolean containsInterval() {
        boolean result = true;

        if (from.isAfter(app.getTo())) {
            return false;
        }

        return result;
    }

    /**
     * @return the from
     */
    public Instant getFrom() {
        return from;
    }

    /**
     * @param from the from to set
     */
    public void setFrom(Instant from) {
        this.from = from;
    }

    /**
     * @return the path
     */
    public Path getPath() {
        return path;
    }

    /**
     * @param path the path to set
     */
    public void setPath(Path path) {
        this.path = path;
    }

    /**
     * @return the lc
     */
    public LogConfig getLc() {
        return lc;
    }

    /**
     * @param lc the lc to set
     */
    public void setLc(LogConfig lc) {
        this.lc = lc;
    }

    @Override
    public int compareTo(LogFile o) {
        return getFrom().compareTo(o.getFrom());
    }

    public Instant getFirstTime() {
        Instant res = null;
        try (FileChannel fcOpen = FileChannel.
                open(path, StandardOpenOption.READ)) {
            setFc(fcOpen);
            BinarySearch bs = new BinarySearch();
            res = bs.getZonedDateTime(0, this);
            if (res == null) {
                res = ZonedDateTime.now().toInstant();
            }
        } catch (IOException ex) {
            Logger.getLogger(LogFile.class.getName()).
                    log(Level.SEVERE, null, ex);
        }

        return res;
    }

    public void printInterval(LogFile lfNext) {

        try (FileChannel fcOpen = FileChannel.
                open(path, StandardOpenOption.READ)) {

            setFc(fcOpen);
            setFileSize();

            if (getFileSize() == 0) {
                return;
            }

            BinarySearch bs = new BinarySearch();

            long positionFrom = bs.getPositionFrom(this);
            long positionTo = bs.getPositionTo(positionFrom, this, lfNext);
            
            WritableByteChannel wbc = Channels.newChannel(System.out);
            
            fc.transferTo(positionFrom, positionTo-positionFrom, wbc);
            
            
        } catch (IOException ex) {
            Logger.getLogger(LogFile.class.getName()).
                    log(Level.SEVERE, null, ex);
        }
    }

    /**
     * @return the fileSize
     */
    public long getFileSize() {
        return fileSize;
    }

    /**
     */
    public void setFileSize() {

        try {
            this.fileSize = fc.size();
        } catch (IOException ex) {
            Logger.getLogger(LogFile.class.getName()).
                    log(Level.SEVERE, null, ex);
        }

    }

    /**
     * @return the fc
     */
    public FileChannel getFc() {
        return fc;
    }

    /**
     * @param fc the fc to set
     */
    public void setFc(FileChannel fc) {
        this.fc = fc;
    }

}
