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
import java.nio.CharBuffer;
import java.nio.MappedByteBuffer;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.channels.WritableByteChannel;
import java.nio.charset.Charset;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.MatchResult;
import java.util.regex.Matcher;

public class LogFile implements Comparable<LogFile> {

    Application app = (new ApplicationFactory()).getInstance();

    private Instant from = ZonedDateTime.now().toInstant();
    private Path path;
    private LogConfig lc;
    private long fileSize;
    private FileChannel fc;

    private long positionFrom = 0;
    private long positionTo = 0;
    private boolean interval = false;
    private List<LogRecord> records = new ArrayList();
    private int logOrder;

    public LogFile(Path path, LogConfig lc, int logOrder) {
        this.path = path;
        this.lc = lc;
        from = getFirstTime();
        this.logOrder = logOrder;
    }

    public void checkContainsInterval() {
        interval = true;

        if (from.isAfter(app.getTo())) {
            interval = false;
        }

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

    public void findInterval(LogFile lfNext) {

        if (!interval) {
            return;
        }

        try (FileChannel fcOpen = FileChannel.
                open(path, StandardOpenOption.READ)) {

            setFc(fcOpen);
            setFileSize();

            if (getFileSize() == 0) {
                return;
            }

            BinarySearch bs = new BinarySearch();

            positionFrom = bs.getPositionFrom(this);
            positionTo = bs.getPositionTo(positionFrom, this, lfNext);

        } catch (IOException ex) {
            Logger.getLogger(LogFile.class.getName()).
                    log(Level.SEVERE, null, ex);
        }

    }

    public void printInterval(long intervalStart, long intervalEnd) {

        if (!interval) {
            return;
        }

        try (FileChannel fcOpen = FileChannel.
                open(path, StandardOpenOption.READ)) {

            setFc(fcOpen);

            WritableByteChannel wbc = Channels.newChannel(System.out);

            fc.transferTo(intervalStart, intervalEnd - intervalStart, wbc);

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

    /**
     * @return the positionFrom
     */
    public long getPositionFrom() {
        return positionFrom;
    }

    /**
     * @param positionFrom the positionFrom to set
     */
    public void setPositionFrom(long positionFrom) {
        this.positionFrom = positionFrom;
    }

    /**
     * @return the positionTo
     */
    public long getPositionTo() {
        return positionTo;
    }

    /**
     * @param positionTo the positionTo to set
     */
    public void setPositionTo(long positionTo) {
        this.positionTo = positionTo;
    }

    /**
     * @return the interval
     */
    public boolean isInterval() {
        return interval;
    }

    /**
     * @param interval the interval to set
     */
    public void setInterval(boolean interval) {
        this.interval = interval;
    }

    /**
     * @return the records
     */
    public List<LogRecord> getRecords() {
        return records;
    }

    /**
     * @param records the records to set
     */
    public void setRecords(List<LogRecord> records) {
        this.records = records;
    }

    public void findRecords() {

        //Make scanner
        //Iterate through dates until is reached positionTo
        try (FileChannel fcOpen = FileChannel.
                open(path, StandardOpenOption.READ);) {

            setFc(fcOpen);
            MappedByteBuffer buf = fc.map(FileChannel.MapMode.READ_ONLY,
                    positionFrom, positionTo-positionFrom);
            // Decode ByteBuffer into CharBuffer
            CharBuffer cbuf
                    = Charset.forName("ISO-8859-1").newDecoder().decode(buf);
            Matcher m = lc.getDatePattern().matcher(cbuf);
            BinarySearch bs = new BinarySearch();
            LogRecord prev = null;

            while (m.find()) {
                MatchResult match = m.toMatchResult();
                //System.out.println(match.start() + " " + recFrom);

                CharSequence cs = bs.getZonedDateTime(match, this);
                Instant instant = bs.getZonedDateTime(cs);
                LogRecord lr = new LogRecord(this, instant, m.start());
                records.add(lr);
                if(prev!=null) {
                    prev.setPositionTo(lr.getPositionFrom());
                }
                
                prev=lr;

            }
            
            if(prev!=null) {
                prev.setPositionTo(positionTo-positionFrom);
            }

        } catch (IOException ex) {
            Logger.getLogger(BinarySearch.class.getName()).
                    log(Level.SEVERE, null, ex);
        } catch (Exception ex) {
            Logger.getLogger(BinarySearch.class.getName()).
                    log(Level.SEVERE, null, ex);
        }

    }

    /**
     * @return the logOrder
     */
    public int getLogOrder() {
        return logOrder;
    }

    /**
     * @param logOrder the logOrder to set
     */
    public void setLogOrder(int logOrder) {
        this.logOrder = logOrder;
    }

}
