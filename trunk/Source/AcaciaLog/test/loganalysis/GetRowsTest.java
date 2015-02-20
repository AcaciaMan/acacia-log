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
import java.util.TreeSet;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author User
 */
public class GetRowsTest {

    public GetRowsTest() {
    }

    @BeforeClass
    public static void setUpClass() {
    }

    @AfterClass
    public static void tearDownClass() {
    }

    @Before
    public void setUp() {
    }

    @After
    public void tearDown() {
    }

    /**
     * Test of getInterval method, of class GetRows.
     */
    @Test
    public void testGetInterval() {
        System.out.println("getInterval");

        Application app = (new ApplicationFactory()).getInstance();

        //2015-02-08	11:52:02:310
        //2015-01-30 17:02:36
        //2015-02-20 09:09:25.873
        //2015-01-30T17:02:43.000Z
        app.cmd.setFrom("2015-02-20T09:09:25.000Z");
        app.cmd.setTo("2015-02-20T09:09:26.000Z");

        app.cmd.setInclude("wu");
        //app.cmd.setExclude("wu;cbs");
        app.load();

        GetRows instance = new GetRows();
        instance.findInterval();
        instance.printInterval();

    }

    /**
     * Test of findLogRecords method, of class GetRows.
     */
    @Test
    public void testFindLogRecords() {
        System.out.println("findLogRecords");

        Application app = (new ApplicationFactory()).getInstance();

        //2015-02-08	11:52:02:310
        //2015-01-30 17:02:36
        app.cmd.setFrom("2015-02-19T09:07:46.000Z");
        app.cmd.setTo("2015-02-20T09:07:47.000Z");

        app.cmd.setInclude("wu");
        //app.cmd.setExclude("wu;cbs");
        app.load();

        GetRows instance = new GetRows();
        instance.findInterval();
        instance.findLogRecords();

        for (String s : app.getSections()) {
            LogConfig lc = app.logs.get(s);
            TreeSet<LogFile> lfts = lc.getLogFiles();

            for (LogFile lf : lfts) {
                System.out.println(lf.getPositionFrom() + " " + lf.
                        getPositionTo() + " " + lf.getFileSize());
                for (LogRecord lr : lf.getRecords()) {
                    System.out.println(
                            lr.getInstant() + " " + lr.getLf().getLogOrder() + " " + lr.
                            getPositionFrom() + " " + lr.getPositionTo());
                }
            }

        }

    }

    /**
     * Test of printLongestOperation method, of class GetRows.
     */
    @Test
    public void testPrintLongestOperation() {
        System.out.println("printLongestOperation");

        Application app = (new ApplicationFactory()).getInstance();

        //2015-02-08	11:52:02:310
        //2015-01-30 17:02:36
        app.cmd.setFrom("2015-02-19T09:07:46.000Z");
        app.cmd.setTo("2015-02-20T09:07:47.000Z");

        app.cmd.setInclude("wu");
        //app.cmd.setExclude("wu;cbs");
        app.load();

        GetRows instance = new GetRows();
        instance.findInterval();
        instance.findLogRecords();
        instance.printLongestOperations();

    }

}
