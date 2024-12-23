import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Any

class AcaciaLog:
    def __init__(self):
        self.cmd: Dict[str, Any] = {
    "verbose": False,
    "from": None,
    "to": None,
    "list_last_files": False,
    "print_interval": False,
    "find_interval": False,
    "remove_dates": False,
    "print_longest_operations": False,
    "include": None,
    "exclude": None,
    "top": 10
}
        self.cmd = self.load_json_config('Source/AcaciaLog/acacialog.json')
        self.cmd = self.parse_cmd_line(sys.argv[1:])
        self.logs = {}
        self.sections = []
        self.load()

    def load_json_config(self, file_path):
        with open(file_path, 'r') as f:
            return json.load(f)

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
        for section in self.config.keys():
            dir_path = self.config[section]['DIR']
            file_pattern = self.config[section]['FILE']
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
        for section in self.sections:
            lc = self.logs[section]
            list_files = self.get_interval_files(lc)
            lc['log_files'] = list_files

            for i, lf in enumerate(list_files):
                lf_next = list_files[i + 1] if i + 1 < len(list_files) else None
                self.find_interval_for_log_file(lf, lf_next)

    def print_interval(self):
        for section in self.sections:
            lc = self.logs[section]
            print(f"{section} {lc['log_files'][0]['path'].name} ... {lc['log_files'][-1]['path'].name}")
            for lf in lc['log_files']:
                self.print_interval_for_log_file(lf)

    def find_log_records(self):
        for section in self.sections:
            lc = self.logs[section]
            for lf in lc['log_files']:
                self.find_records_for_log_file(lf)

    def print_longest_operations(self):
        top = self.cmd['top']
        longest = []

        for section in self.sections:
            lc = self.logs[section]
            for lf in lc['log_files']:
                for lr in lf['records']:
                    if len(longest) < top:
                        longest.append(lr)
                    else:
                        if lr['duration'] > min(longest, key=lambda x: x['duration'])['duration']:
                            longest.remove(min(longest, key=lambda x: x['duration']))
                            longest.append(lr)

        longest.sort(key=lambda x: x['duration'], reverse=True)
        for lr in longest:
            print(f"{lr['duration']} {lr['log_file']['path'].name} {lr['content']}")

    def remove_dates(self):
        for section in self.sections:
            lc = self.logs[section]
            for lf in lc['log_files']:
                self.remove_dates_from_log_file(lf)

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

    def load(self):
        self.logs.clear()
        self.setup_sections()

        for section in self.sections:
            lc = self.create_log_config(section)
            self.logs[section] = lc

    def setup_sections(self):
        self.sections.clear()

        if self.cmd['include']:
            self.sections = [f"[{s.strip()}]" for s in self.cmd['include'].split(';')]
        elif self.config.get('INCLUDE'):
            self.sections = [f"[{s.strip()}]" for s in self.config['INCLUDE'].split(';')]
        else:
            self.sections = self.config.keys()

        if self.cmd['exclude']:
            exclude_sections = [f"[{s.strip()}]" for s in self.cmd['exclude'].split(';')]
            self.sections = [s for s in self.sections if s not in exclude_sections]
        elif self.config.get('EXCLUDE'):
            exclude_sections = [f"[{s.strip()}]" for s in self.config['EXCLUDE'].split(';')]
            self.sections = [s for s in self.sections if s not in exclude_sections]

    def create_log_config(self, section):
        lc = {
            'log_name': section,
            'dir_path': Path(self.config[section]['DIR']),
            'file_pattern': self.config[section]['FILE'],
            'date_format': self.config[section]['DATE'],
            'zoned_date_time': self.config[section]['ZONED_DATE_TIME'],
            'log_files': []
        }
        lc['date_pattern'] = re.compile(lc['date_format'])
        lc['zoned_char_array'] = list(lc['zoned_date_time'])
        return lc

    def get_interval_files(self, lc):
        log_files = []
        for root, _, files in os.walk(lc['dir_path']):
            for file in files:
                if re.match(lc['file_pattern'], file):
                    log_file = {
                        'path': Path(root) / file,
                        'lc': lc,
                        'from': self.get_first_time(Path(root) / file, lc),
                        'interval': False,
                        'records': []
                    }
                    log_files.append(log_file)

        for lf in log_files:
            lf['interval'] = self.check_contains_interval(lf)

        return sorted(log_files, key=lambda x: x['from'])

    def get_first_time(self, path, lc):
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                match = lc['date_pattern'].search(line)
                if match:
                    return datetime.strptime(match.group(), lc['date_format']).timestamp()
        return datetime.now().timestamp()

    def check_contains_interval(self, lf):
        return lf['from'] <= datetime.strptime(self.cmd['to'], '%Y-%m-%dT%H:%M:%S.%fZ').timestamp()

    def find_interval_for_log_file(self, lf, lf_next):
        with open(lf['path'], 'r', encoding='utf-8') as f:
            content = f.read()
            lf['position_from'] = self.search_position(content, self.cmd['from'], 0, len(content), lf['lc'])
            lf['position_to'] = self.search_position(content, self.cmd['to'], lf['position_from'], len(content), lf['lc'], lf_next)

    def search_position(self, content, target_time, start, end, lc, lf_next=None):
        target_time = datetime.strptime(target_time, '%Y-%m-%dT%H:%M:%S.%fZ').timestamp()
        while start < end:
            mid = (start + end) // 2
            match = lc['date_pattern'].search(content, mid)
            if match:
                mid_time = datetime.strptime(match.group(), lc['date_format']).timestamp()
                if mid_time < target_time:
                    start = mid + 1
                else:
                    end = mid

        return start

    def print_interval_for_log_file(self, lf):
        with open(lf['path'], 'r', encoding='utf-8') as f:
            f.seek(lf['position_from'])
            print(f.read(lf['position_to'] - lf['position_from']))

    def find_records_for_log_file(self, lf):
        with open(lf['path'], 'r', encoding='utf-8') as f:
            content = f.read()
            matches = list(lf['lc']['date_pattern'].finditer(content))
            for i, match in enumerate(matches):
                record = {
                    'log_file': lf,
                    'instant': datetime.strptime(match.group(), lf['lc']['date_format']).timestamp(),
                    'position_from': match.start(),
                    'position_to': matches[i + 1].start() if i + 1 < len(matches) else len(content),
                    'duration': 0
                }
                lf['records'].append(record)

            for i, record in enumerate(lf['records']):
                if i > 0:
                    record['duration'] = record['instant'] - lf['records'][i - 1]['instant']

    def remove_dates_from_log_file(self, lf):
        with open(lf['path'], 'r', encoding='utf-8') as f:
            content = f.read()
            new_content = lf['lc']['date_pattern'].sub('', content)
            print(new_content)

if __name__ == '__main__':
    acacia_log = AcaciaLog()
    acacia_log.run()
