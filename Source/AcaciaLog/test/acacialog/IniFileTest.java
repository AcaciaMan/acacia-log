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
package acacialog;

import java.io.IOException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import static org.junit.Assert.*;

public class IniFileTest {
    
    public IniFileTest() {
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
     * Test of getSections method, of class IniFile.
     */
    @Test
    public void testGetSections() {
        System.out.println("getSections");
        IniFile instance = null;
        try {
            instance = new IniFile("c:/work/log/Project/AcaciaLog/acacialog.ini");
        } catch (IOException ex) {
            Logger.getLogger(IniFileTest.class.getName()).log(Level.SEVERE, null, ex);
        }
        List<String> expResult = null;
        List<String> result = instance.getSections();
        
        for(String s:result) {
            System.out.println("Sections " + s);
        }
    }
    
}
