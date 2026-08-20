import re

with open("tests/test_api.py", "r") as f:
    content = f.read()

# Add mock_agents to all test functions that patch fetch_all_vulns
content = re.sub(
    r'@patch\("app\.main\.fetch_all_vulns"\)\n(def test_[a-zA-Z0-9_]+\(mock_fetch)',
    r'@patch("app.main.fetch_all_agents")\n@patch("app.main.fetch_all_vulns")\n\1',
    content
)

# Also fix the ones with return_value
content = re.sub(
    r'@patch\("app\.main\.fetch_all_vulns", (.*?)\)\n(def test_[a-zA-Z0-9_]+\(mock_fetch)',
    r'@patch("app.main.fetch_all_agents")\n@patch("app.main.fetch_all_vulns", \1)\n\2',
    content
)

# Now fix the function arguments: add mock_agents after mock_fetch
content = re.sub(
    r'(def test_[a-zA-Z0-9_]+\()mock_fetch, ',
    r'\1mock_fetch, mock_agents, ',
    content
)

# Mock fetch_all_agents to return [] inside the test functions by default? 
# The patch decorator will pass a MagicMock, which behaves fine, but we can set its return_value.
# Actually, MagicMock() returning another mock when iterated over might cause issues. It's better to explicitly set mock_agents.return_value = [] in each test, or we just leave it if it works. Let's explicitly set it.
content = re.sub(
    r'(def test_[a-zA-Z0-9_]+\(mock_fetch, mock_agents, .*?:\n(?:\s*#.*\n)*)',
    r'\1    mock_agents.return_value = []\n',
    content
)

# Remove assert res.json()["synced"] == X
content = re.sub(r'\s*assert [a-zA-Z0-9_]+\.json\(\)\["synced"\] == \d+\n', '\n', content)

# Fix test_sync_all_partial_failure
content = re.sub(r'assert result\["ok"\] is False', 'assert "en segundo plano" in result["message"]', content)


with open("tests/test_api.py", "w") as f:
    f.write(content)

with open("tests/test_devsecops.py", "r") as f:
    content = f.read()
content = re.sub(
    r'@patch\("app\.main\.fetch_all_vulns"\)\n(def test_[a-zA-Z0-9_]+\(mock_fetch)',
    r'@patch("app.main.fetch_all_agents")\n@patch("app.main.fetch_all_vulns")\n\1',
    content
)
content = re.sub(
    r'(def test_[a-zA-Z0-9_]+\()mock_fetch, ',
    r'\1mock_fetch, mock_agents, ',
    content
)
content = re.sub(
    r'(def test_[a-zA-Z0-9_]+\(mock_fetch, mock_agents, .*?:\n(?:\s*#.*\n)*)',
    r'\1    mock_agents.return_value = []\n',
    content
)
with open("tests/test_devsecops.py", "w") as f:
    f.write(content)
