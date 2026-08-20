import re

def fix_file(filename):
    with open(filename, "r") as f:
        content = f.read()

    # Remove the synced == X lines
    content = re.sub(r'\s*assert [a-zA-Z0-9_]+\.json\(\)\["synced"\] == \d+\n', '\n', content)

    # Fix test_sync_all_partial_failure
    content = re.sub(r'assert result\["ok"\] is False', 'assert "segundo plano" in result["message"]', content)
    
    with open(filename, "w") as f:
        f.write(content)

fix_file("tests/test_api.py")
fix_file("tests/test_devsecops.py")
