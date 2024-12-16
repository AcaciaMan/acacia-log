import unittest
import subprocess
import os

class AcaciaLogTest(unittest.TestCase):

    def run_acacialog_script(self, args):
        script_path = os.path.join(os.path.dirname(__file__), '../../acacialog.py')
        result = subprocess.run(['python', script_path] + args, capture_output=True, text=True)
        return result.stdout.strip()

    def test_verbose_option(self):
        output = self.run_acacialog_script(['-verbose'])
        expected_output = "Expected output for -verbose option"
        self.assertEqual(output, expected_output)

    def test_from_to_option(self):
        output = self.run_acacialog_script(['-from', '2015-02-08T11:53:02.310Z', '-to', '2015-02-09T12:53:03.311Z'])
        expected_output = "Expected output for -from and -to options"
        self.assertEqual(output, expected_output)

    def test_include_exclude_option(self):
        output = self.run_acacialog_script(['-include', 'wu', '-exclude', 'cbs'])
        expected_output = "Expected output for -include and -exclude options"
        self.assertEqual(output, expected_output)

    def test_top_option(self):
        output = self.run_acacialog_script(['-top', '5'])
        expected_output = "Expected output for -top option"
        self.assertEqual(output, expected_output)

    def test_l_option(self):
        output = self.run_acacialog_script(['-l'])
        expected_output = "Expected output for -l option"
        self.assertEqual(output, expected_output)

    def test_i_option(self):
        output = self.run_acacialog_script(['-i'])
        expected_output = "Expected output for -i option"
        self.assertEqual(output, expected_output)

    def test_o_option(self):
        output = self.run_acacialog_script(['-o'])
        expected_output = "Expected output for -o option"
        self.assertEqual(output, expected_output)

    def test_r_option(self):
        output = self.run_acacialog_script(['-r'])
        expected_output = "Expected output for -r option"
        self.assertEqual(output, expected_output)

if __name__ == '__main__':
    unittest.main()
