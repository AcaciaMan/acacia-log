import configparser
import os
import re
import sys
from datetime import datetime, timedelta

class AcaciaLog:
    def __init__(self):
        self.config = configparser.ConfigParser()
        self.config.read('Source/AcaciaLog/acacialog.ini')
        self.properties = self.load_properties('Source/AcaciaLog/acacialog.properties')
        self.cmd = self.parse_cmd_line(sys.argv[1:])

    def load_properties(self, file_path):
        properties = {}
        with open(file_path, 'r') as f:
            for line in f:
                if '=' in line:
                    key, value = line.split('=', 1)
                    properties[key.strip()] = value.strip()
        return properties

    def parse_cmd_line(self, args):
        cmd = {
            'verbose': False,
            'from': None,
            'to': None,
            'list_last_files': False,
            'print_interval': False,
            'find_interval': False,
            'remove_dates': False,
            'print_longest_operations': False,
            'include': None,
            'exclude': None,
            'top': 10
        }

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == '-verbose':
                cmd['verbose'] = True
            elif arg == '-from':
                i += 1
                cmd['from'] = args[i]
            elif arg == '-to':
                i += 1
                cmd['to'] = args[i]
            elif arg == '-include':
                i += 1
                cmd['include'] = args[i]
            elif arg == '-exclude':
                i += 1
                cmd['exclude'] = args[i]
            elif arg == '-top':
                i += 1
                cmd['top'] = int(args[i])
            else:
                for flag in arg[1:]:
                    if flag == 'l':
                        cmd['list_last_files'] = True
                    elif flag == 'i':
                        cmd['print_interval'] = True
                    elif flag == 'o':
                        cmd['print_longest_operations'] = True
                    elif flag == 'r':
                        cmd['remove_dates'] = True
            i += 1

        return cmd

    def list_last_files(self):
        for section in self.config.sections():
            dir_path = self.config.get(section, 'DIR')
            file_pattern = self.config.get(section, 'FILE')
            last_modified = None

            for root, _, files in os.walk(dir_path):
                for file in files:
                    if re.match(file_pattern, file):
                        file_path = os.path.join(root, file)
                        file_mtime = os.path.getmtime(file_path)
                        if last_modified is None or file_mtime > last_modified:
                            last_modified = file_mtime
                            last_file = file_path

            if last_modified:
                print(f"{section} {datetime.fromtimestamp(last_modified)} {last_file}")
            else:
                print(f"{section} NO_LOG_FILE_FOUND {file_pattern}")

    def find_interval(self):
        # Implement the find_interval functionality here
        pass

    def print_interval(self):
        # Implement the print_interval functionality here
        pass

    def find_log_records(self):
        # Implement the find_log_records functionality here
        pass

    def print_longest_operations(self):
        # Implement the print_longest_operations functionality here
        pass

    def remove_dates(self):
        # Implement the remove_dates functionality here
        pass

    def run(self):
        if self.cmd['list_last_files']:
            self.list_last_files()
        if self.cmd['find_interval']:
            self.find_interval()
        if self.cmd['print_interval']:
            self.print_interval()
        if self.cmd['print_longest_operations']:
            self.find_log_records()
            self.print_longest_operations()
        if self.cmd['remove_dates']:
            self.remove_dates()

if __name__ == '__main__':
    acacia_log = AcaciaLog()
    acacia_log.run()
