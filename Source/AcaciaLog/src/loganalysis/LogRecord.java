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

import java.time.Duration;
import java.time.Instant;

public class LogRecord implements Comparable<LogRecord> {

    private Instant instant;
    private long positionFrom;
    private long positionTo;
    private Duration duration;
    private LogFile lf;

    public LogRecord(LogFile lf, Instant instant, long positionFrom) {
        this.lf = lf;
        this.instant = instant;
        this.positionFrom = positionFrom;
    }

    @Override
    public int compareTo(LogRecord o) {
        int res = instant.compareTo(o.instant);

        if (res != 0) {
            res = lf.getLogOrder() - o.lf.getLogOrder();
            if (res != 0) {
                res = (int) (positionFrom - o.positionFrom);
            }

        }

        return res;
    }

    /**
     * @return the instant
     */
    public Instant getInstant() {
        return instant;
    }

    /**
     * @param instant the instant to set
     */
    public void setInstant(Instant instant) {
        this.instant = instant;
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
     * @return the duration
     */
    public Duration getDuration() {
        return duration;
    }

    /**
     * @param duration the duration to set
     */
    public void setDuration(Duration duration) {
        this.duration = duration;
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
     * @return the lf
     */
    public LogFile getLf() {
        return lf;
    }

    /**
     * @param lf the lf to set
     */
    public void setLf(LogFile lf) {
        this.lf = lf;
    }

}
