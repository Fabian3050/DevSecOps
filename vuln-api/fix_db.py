import re

def fix_file(filename):
    with open(filename, "r") as f:
        content = f.read()

    # Find all tests that use @patch("app.main.fetch_all_agents") and need SessionLocal mocked
    # We will just patch SessionLocal on them.
    # The signature is def test_name(mock_fetch, mock_agents, client, db_session):
    
    pattern = r'(@patch\("app\.main\.fetch_all_agents"\)\n@patch\("app\.main\.fetch_all_vulns"(?:, return_value=MOCK_VULN)?\)\n)(def test_[a-zA-Z0-9_]+\(mock_fetch, mock_agents, client, db_session\):\n)'
    replacement = r'\1@patch("app.main.SessionLocal")\n\2    mock_session.return_value = db_session\n'
    
    # Wait, we need to add mock_session to the function arguments
    # def test_name(mock_fetch, mock_agents, mock_session, client, db_session):
    def repl(m):
        prefix = m.group(1)
        func_def = m.group(2)
        func_def = func_def.replace("client, db_session", "mock_session, client, db_session")
        return prefix + '@patch("app.main.SessionLocal")\n' + func_def + '    mock_session.return_value = db_session\n'

    content = re.sub(pattern, repl, content)
    
    with open(filename, "w") as f:
        f.write(content)

fix_file("tests/test_api.py")
fix_file("tests/test_devsecops.py")
