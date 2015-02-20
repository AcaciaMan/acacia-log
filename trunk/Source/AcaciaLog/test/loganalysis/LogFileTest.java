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
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.Scanner;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.MatchResult;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import static org.junit.Assert.*;

public class LogFileTest {

    public LogFileTest() {
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
     * Test of containsInterval method, of class LogFile.
     */
    @Test
    public void testContainsInterval() {
        System.out.println("containsInterval");

        Application app = (new ApplicationFactory()).getInstance();
        app.cmd.setFrom("2010-02-07T20:23:35.111Z");
        app.cmd.setTo("2018-02-07T20:23:35.111Z");
        
        Path p = Paths.get("c:/windows/WindowsUpdate.log");
        LogConfig lc = app.logs.get("[wu]");

        LogFile instance = new LogFile(p, lc, 0);
        boolean expResult = true;
        instance.checkContainsInterval();
        boolean result = instance.isInterval();
        assertEquals(expResult, result);
    }

    @Test
    public void testGetFirstTime() {
        System.out.println("getFirstTime");

        Application app = (new ApplicationFactory()).getInstance();
        app.cmd.setFrom("2015-02-07T20:23:35.111Z");

        Path p = Paths.get("c:/windows/WindowsUpdate.log");
        LogConfig lc = app.logs.get("[wu]");

        LogFile instance = new LogFile(p, lc, 0);

        Instant i = instance.getFirstTime();
        System.out.println("firstTime " + i);

        // 2015-02-07	14:52:32:461
        Pattern pattern = Pattern.compile(
                "^(\\d{4})-(\\d{2})-(\\d{2})\\t(\\d{2}):(\\d{2}):(\\d{2}):(\\d{3})\\t");
        try {
            Scanner scanner = new Scanner(p);
            String res = scanner.findWithinHorizon(pattern, 0);
            System.out.println("Res " + res);

            MatchResult match = scanner.match();
            String g1 = match.group(1);
            String g2 = match.group(2);
            String g3 = match.group(3);
            String g4 = match.group(4);
            String g5 = match.group(5);
            String g6 = match.group(6);
            String g7 = match.group(7);

            //DateTimeFormatter dtf = DateTimeFormatter.ofPattern("uuuu-MM-dd-HH:mm:ss:SSS");
            Instant inst = ZonedDateTime.parse(
                    g1 + "-" + g2 + "-" + g3 + "T" + g4 + ":" + g5 + ":" + g6 + "." + g7 + "Z").
                    toInstant();
            System.out.println("inst " + inst);
        } catch (IOException ex) {
            Logger.getLogger(LogFileTest.class.getName()).
                    log(Level.SEVERE, null, ex);
        }

    }

    @Test
    public void testGetPosition() {
        System.out.println("getPosition");

        Application app = (new ApplicationFactory()).getInstance();
        app.cmd.setFrom("2015-02-07T20:23:35.111Z");
        app.cmd.setTo("2015-02-11T20:23:35.111Z");

        Path p = Paths.get("c:/windows/WindowsUpdate.log");
        LogConfig lc = app.logs.get("[wu]");

        LogFile instance = new LogFile(p, lc, 0);

        Instant i = instance.getFirstTime();
        System.out.println("firstTime " + i);

        // 2015-02-07	14:52:32:461
        Pattern pattern = Pattern.compile(
                "(?m)^(\\d{4})-(\\d{2})-(\\d{2})\\t(\\d{2}):(\\d{2}):(\\d{2}):(\\d{3})\\t");
        try {
            Scanner scanner = new Scanner(p);
            String res = scanner.findWithinHorizon(pattern, 0);
            System.out.println("Res " + res);
            
            FileChannel fc = FileChannel.open(p, StandardOpenOption.READ);
            MappedByteBuffer bb = fc.map(FileChannel.MapMode.READ_ONLY, 0, fc.size());
            CharBuffer cb = StandardCharsets.UTF_8.decode(bb);
            
            Matcher matcher = pattern.matcher(cb);
            if(matcher.find(700)) {
                System.out.println("Matcher " + matcher.group());
            }
            
            MatchResult mr;
            scanner = new Scanner(fc);
            fc.position(700);
            res = scanner.findWithinHorizon(pattern, 0);
            mr = scanner.match();
            System.out.println("Res " + res);
            System.out.println("Position " + mr.start());

            //scanner = new Scanner(fc);
            //scanner.reset();
            fc.position(0);
            res = scanner.findWithinHorizon(pattern, 0);
            mr = scanner.match();
            System.out.println("Res " + res);
            System.out.println("Position " + mr.start());

            
        } catch (IOException ex) {
            Logger.getLogger(LogFileTest.class.getName()).
                    log(Level.SEVERE, null, ex);
        }

    }

}
