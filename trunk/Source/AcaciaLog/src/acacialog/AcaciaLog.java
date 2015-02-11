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

import loganalysis.GetRows;
import loganalysis.ListFiles;

public class AcaciaLog {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {

        ApplicationFactory factory = new ApplicationFactory();
        Application app = factory.getInstance();

        app.cmd.parse(args);

        if (app.cmd.isListLastFiles()) {
            ListFiles instance = new ListFiles();
            instance.listLastFiles();
            System.out.println("");
        }
        
        if (app.cmd.isPrintInterval()) {
            GetRows gr = new GetRows();
            gr.getInterval();
            System.out.println("");
        }

    }

}
