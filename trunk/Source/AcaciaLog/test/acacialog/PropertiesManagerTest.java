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

import java.nio.file.Path;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import static org.junit.Assert.*;

public class PropertiesManagerTest {
    
    public PropertiesManagerTest() {
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
     * Test of getPath method, of class PropertiesManager.
     */
    @Test
    public void testGetPath() {
        System.out.println("getPath");
        PropertiesManager instance = new PropertiesManager();
        Path expResult = null;
        Path result = instance.getPath();
        assertEquals(expResult, result);
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }

    /**
     * Test of load method, of class PropertiesManager.
     */
    @Test
    public void testLoad() {
        System.out.println("load");
        PropertiesManager instance = new PropertiesManager();
        instance.load();
        // TODO review the generated test code and remove the default call to fail.
        System.out.println("INI_FILE " + instance.props.getProperty(PropertiesList.INI_FILE.name()));
        
        return;
    }

    /**
     * Test of store method, of class PropertiesManager.
     */
    @Test
    public void testStore() {
        System.out.println("store");
        PropertiesManager instance = new PropertiesManager();
        instance.store();
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }
    
}
