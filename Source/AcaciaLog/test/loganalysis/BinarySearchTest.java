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
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.MatchResult;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import static org.junit.Assert.*;

public class BinarySearchTest {
    
    public BinarySearchTest() {
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
     * Test of getPositionFrom method, of class BinarySearch.
     */
    @Test
    public void testGetPositionFrom() {
        System.out.println("getPositionFrom");
        LogFile lf = null;
        BinarySearch instance = new BinarySearch();
        long expResult = 0L;
        long result = instance.getPositionFrom(lf);
        assertEquals(expResult, result);
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }

    /**
     * Test of getPositionTo method, of class BinarySearch.
     */
    @Test
    public void testGetPositionTo() {
        System.out.println("getPositionTo");
        long positionFrom = 0L;
        LogFile lf = null;
        LogFile lfNext = null;
        BinarySearch instance = new BinarySearch();
        long expResult = 0L;
        long result = instance.getPositionTo(positionFrom, lf, lfNext);
        assertEquals(expResult, result);
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }

    /**
     * Test of getZonedDateTime method, of class BinarySearch.
     */
    @Test
    public void testGetZonedDateTime_long_LogFile() {
        System.out.println("getZonedDateTime");
        long positionFrom = 0L;
        LogFile lf = null;
        BinarySearch instance = new BinarySearch();
        Instant expResult = null;
        Instant result = instance.getZonedDateTime(positionFrom, lf);
        assertEquals(expResult, result);
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }

    /**
     * Test of getZonedDateTime method, of class BinarySearch.
     */
    @Test
    public void testGetZonedDateTime_MatchResult_LogFile() {
        System.out.println("getZonedDateTime");
        MatchResult matcher = null;
        LogFile lf = null;
        BinarySearch instance = new BinarySearch();
        CharSequence expResult = null;
        CharSequence result = instance.getZonedDateTime(matcher, lf);
        assertEquals(expResult, result);
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }

    /**
     * Test of searchPosition method, of class BinarySearch.
     */
    @Test
    public void testSearchPosition() {
        System.out.println("searchPosition");
        
        Application app = (new ApplicationFactory()).getInstance();
        // 2015-02-08	11:52:01:989
        //2015-02-08	11:52:02:052
        app.cmd.setFrom("2015-02-13T11:52:02.053Z");

        Path p = Paths.get("c:/windows/WindowsUpdate.log");
        LogConfig lc = app.logs.get("[wu]");

        LogFile lf = new LogFile(p, lc);
        
        try (FileChannel fc = FileChannel.open(p, StandardOpenOption.READ)) {
        
        lf.setFc(fc);
        Instant inst = app.getFrom();
        long from = 0L;
        long to = fc.size();
        BinarySearch instance = new BinarySearch();
        long expResult = 0L;
        long result = instance.searchPosition(lf, inst, from, to);

        System.out.println("Size " + fc.size());
        System.out.println("Inst " + inst + " Res " + result);
    
        } catch (IOException ex) {
            Logger.getLogger(BinarySearchTest.class.getName()).
                    log(Level.SEVERE, null, ex);
        }
    }
    
}
