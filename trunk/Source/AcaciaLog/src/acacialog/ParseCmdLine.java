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
    private boolean findInterval = false;
    private boolean printLongestOperations = false;
    private String include;
    private String exclude;
    private int top = 10;

    public void parse(String args[]) {

        int i = 0, j;
        String arg;
        char flag;

        while (i < args.length && args[i].startsWith("-")) {
            arg = args[i++];

            // use this type of check for "wordy" arguments
            switch (arg) {
            // use this type of check for arguments that require arguments
                case "-verbose":
                    System.out.println("verbose mode on");
                    setVerbose(true);
                    break;
                case "-from":
                    if (i < args.length) {
                        setFrom(args[i++]);
                    } else {
                        System.err.println("-from requires a time");
                    }   if (isVerbose()) {
                        System.out.println("-from = " + getFrom());
                    }   break;
                case "-to":
                    if (i < args.length) {
                        setTo(args[i++]);
                    } else {
                        System.err.println("-to requires a time");
                    }   if (isVerbose()) {
                        System.out.println("-to = " + getTo());
                }   break;
                case "-include":
                    if (i < args.length) {
                        setInclude(args[i++]);
                    } else {
                        System.err.println("-include requires an acacialog.ini sections list wu;cbs");
                    }   if (isVerbose()) {
                        System.out.println("-include = " + getInclude());
                    }   break;
                case "-exclude":
                    if (i < args.length) {
                        setInclude(args[i++]);
                    } else {
                        System.err.println("-exclude requires an acacialog.ini sections list wu;cbs");
                    }   if (isVerbose()) {
                        System.out.println("-exclude = " + getExclude());
                    }   break;
                default:
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
                            case 'o':
                                setPrintLongestOperations(true);
                                if (isVerbose()) {
                                    System.out.println("Option o printLongestOperations");
                                }
                                break;

                                
                            default:
                                System.err.println(
                                        "ParseCmdLine: illegal option " + flag);
                            break;
                    }
                }   break;
            }
        }
        if (i < args.length) {
            System.err.println(
                    "Usage: AcaciaLog [-verbose] [-lio] [-from aTime] [-to aTime] [-include sectionsList] [-exclude sectionsList] [-top n]");
            System.err.println("-l list last modified log files");
            System.err.println("-i print interval [from,to) log rows");
            System.err.println("-o print top (default 10) longest operations from interval [from,to) log rows");
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
        this.findInterval = printInterval;
        this.printInterval = printInterval;
    }

    /**
     * @return the include
     */
    public String getInclude() {
        return include;
    }

    /**
     * @param include the include to set
     */
    public void setInclude(String include) {
        this.include = include;
    }

    /**
     * @return the exclude
     */
    public String getExclude() {
        return exclude;
    }

    /**
     * @param exclude the exclude to set
     */
    public void setExclude(String exclude) {
        this.exclude = exclude;
    }

    /**
     * @return the top
     */
    public int getTop() {
        return top;
    }

    /**
     * @param top the top to set
     */
    public void setTop(int top) {
        this.top = top;
    }

    /**
     * @return the findInterval
     */
    public boolean isFindInterval() {
        return findInterval;
    }

    /**
     * @param findInterval the findInterval to set
     */
    public void setFindInterval(boolean findInterval) {
        this.findInterval = findInterval;
    }

    /**
     * @return the printLongestOperations
     */
    public boolean isPrintLongestOperations() {
        return printLongestOperations;
    }

    /**
     * @param printLongestOperations the printLongestOperations to set
     */
    public void setPrintLongestOperations(boolean printLongestOperations) {
        this.findInterval = printLongestOperations;
        this.printLongestOperations = printLongestOperations;
    }

}
