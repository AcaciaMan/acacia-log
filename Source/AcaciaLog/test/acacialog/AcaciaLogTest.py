import unittest
import subprocess
import os

class AcaciaLogTest(unittest.TestCase):

    def test_acacialog_script(self):
        script_path = os.path.join(os.path.dirname(__file__), '../../acacialog.py')
        log_path = os.path.join(os.path.dirname(__file__), '../../example.log')
        result = subprocess.run(['python', script_path, log_path], capture_output=True, text=True)
        expected_output = "Expected output based on example.log"
        self.assertEqual(result.stdout.strip(), expected_output)

if __name__ == '__main__':
    unittest.main()
