/*
 * Copyright (c) 1994 Sun Microsystems, Inc. All Rights Reserved.
 *
 * Permission to use, copy, modify, and distribute this software
 * and its documentation for NON-COMMERCIAL purposes and without
 * fee is hereby granted provided that this copyright notice
 * appears in all copies. Please refer to the file "copyright.html"
 * for further important copyright and licensing information.
 *
 * SUN MAKES NO REPRESENTATIONS OR WARRANTIES ABOUT THE SUITABILITY OF
 * THE SOFTWARE, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
 * TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE, OR NON-INFRINGEMENT. SUN SHALL NOT BE LIABLE FOR
 * ANY DAMAGES SUFFERED BY LICENSEE AS A RESULT OF USING, MODIFYING OR
 * DISTRIBUTING THIS SOFTWARE OR ITS DERIVATIVES.
 */
package acacialog;

public class ParseCmdLine {

    private boolean verbose = false;
    private String from = null;
    private String to = null;
    private boolean listLastFiles = false;
    private boolean printInterval = false;

    public void parse(String args[]) {

        int i = 0, j;
        String arg;
        char flag;

        while (i < args.length && args[i].startsWith("-")) {
            arg = args[i++];

            // use this type of check for "wordy" arguments
            if (arg.equals("-verbose")) {
                System.out.println("verbose mode on");
                setVerbose(true);
            } // use this type of check for arguments that require arguments
            else if (arg.equals("-from")) {
                if (i < args.length) {
                    setFrom(args[i++]);
                } else {
                    System.err.println("-from requires a time");
                }
                if (isVerbose()) {
                    System.out.println("-from = " + getFrom());
                }
            } else if (arg.equals("-to")) {
                if (i < args.length) {
                    setTo(args[i++]);
                } else {
                    System.err.println("-to requires a time");
                }
                if (isVerbose()) {
                    System.out.println("-to = " + getTo());
                }
            } // use this type of check for a series of flag arguments
            else {
                for (j = 1; j < arg.length(); j++) {
                    flag = arg.charAt(j);
                    switch (flag) {
                        case 'l':
                            setListLastFiles(true);
                            if (isVerbose()) {
                                System.out.println("Option l listLastFiles");
                            }
                            break;
                        case 'i':
                            setPrintInterval(true);
                            if (isVerbose()) {
                                System.out.println("Option i printIntervalRows");
                            }
                            break;

                        default:
                            System.err.println(
                                    "ParseCmdLine: illegal option " + flag);
                            break;
                    }
                }
            }
        }
        if (i < args.length) {
            System.err.println(
                    "Usage: AcaciaLog [-verbose] [-li] [-from aTime] [-to aTime]");
            System.err.println("-l list last modified log files");
            System.err.println("-i print interval [from,to) log rows");
            System.err.println("java -jar C:\\Work\\log\\Project\\AcaciaLog\\dist\\AcaciaLog.jar -verbose -li -from 2015-02-08T11:52:02.310Z -to 2015-02-09T11:52:02.311Z");
        } else if (isVerbose()) {
            System.out.println("Success!");
        }
    }

    /**
     * @return the verbose
     */
    public boolean isVerbose() {
        return verbose;
    }

    /**
     * @param verbose the verbose to set
     */
    public void setVerbose(boolean verbose) {
        this.verbose = verbose;
    }

    /**
     * @return the from
     */
    public String getFrom() {
        return from;
    }

    /**
     * @param from the from to set
     */
    public void setFrom(String from) {
        this.from = from;
    }

    /**
     * @return the to
     */
    public String getTo() {
        return to;
    }

    /**
     * @param to the to to set
     */
    public void setTo(String to) {
        this.to = to;
    }

    /**
     * @return the listLastFiles
     */
    public boolean isListLastFiles() {
        return listLastFiles;
    }

    /**
     * @param listLastFiles the listLastFiles to set
     */
    public void setListLastFiles(boolean listLastFiles) {
        this.listLastFiles = listLastFiles;
    }

    /**
     * @return the printInterval
     */
    public boolean isPrintInterval() {
        return printInterval;
    }

    /**
     * @param printInterval the printInterval to set
     */
    public void setPrintInterval(boolean printInterval) {
        this.printInterval = printInterval;
    }

}
