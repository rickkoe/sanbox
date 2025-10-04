#!/usr/bin/env python3
"""
Final cleanup of all remaining Bootstrap components
"""

import re

def final_cleanup(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Fix the broken tabs closing structure from previous script
    content = re.sub(
        r'<button className=\{`custom-tab \$\{activeTab === "files" \? "active" : ""\}`\} onClick=\{\(\) => setActiveTab\("files"\)\}>File Upload</button></div><div className="mb-3">\{activeTab === "files" && \(',
        '<button className={`custom-tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>File Upload</button>\n                <button className={`custom-tab ${activeTab === "text" ? "active" : ""}`} onClick={() => setActiveTab("text")}>Text Paste</button>\n              </div>\n              <div className="mb-3">\n                {activeTab === "files" && (\n                  <div>',
        content
    )

    # Replace all Badge components with bg attribute
    content = re.sub(r'<Badge bg="primary">', '<span className="custom-badge custom-badge-primary">', content)
    content = re.sub(r'<Badge bg="secondary">', '<span className="custom-badge custom-badge-secondary">', content)
    content = re.sub(r'<Badge bg="success">', '<span className="custom-badge custom-badge-success">', content)
    content = re.sub(r'<Badge bg="warning">', '<span className="custom-badge custom-badge-warning">', content)
    content = re.sub(r'<Badge bg="danger">', '<span className="custom-badge custom-badge-danger">', content)
    content = re.sub(r'<Badge bg="info">', '<span className="custom-badge custom-badge-primary">', content)
    content = re.sub(r'<Badge\s+bg=\{', '<span className={`custom-badge custom-badge-${', content)
    content = re.sub(r'</Badge>', '</span>', content)

    # Replace remaining Card.Header and Card.Body
    content = re.sub(r'<Card\.Header\s*', '<div className="custom-card-header" ', content)
    content = re.sub(r'</Card\.Header>', '</div>', content)
    content = re.sub(r'<Card\.Body', '<div className="custom-card-body"', content)
    content = re.sub(r'</Card\.Body>', '</div>', content)

    # Replace remaining Alert components
    content = re.sub(r'<Alert variant="info"', '<div className="custom-alert custom-alert-info"', content)
    content = re.sub(r'<Alert variant="warning"', '<div className="custom-alert custom-alert-warning"', content)

    # Fix the text paste section closing
    content = re.sub(
        r'\)\}\n\s*\)\}',
        ')\n                </div>\n              )}\n              {activeTab === "text" && (\n                <div>',
        content,
        count=1
    )

    # Make sure text paste tab has proper structure
    if '</div>\n              )}' not in content[content.find('setTextInput("")'):content.find('setTextInput("")')+500]:
        content = re.sub(
            r'(\s+</div>\s+\)\}\s+{/\* Status Messages \*/})',
            r'\1',
            content
        )

    # Fix any template literal issues in badges
    content = re.sub(r'className=\{`custom-badge custom-badge-\$\{([^}]+)\}`\}', r'className={`custom-badge custom-badge-${(\1).toLowerCase()}`}', content)

    with open(file_path, 'w') as f:
        f.write(content)

    print("✅ Final cleanup complete!")

if __name__ == "__main__":
    final_cleanup("/Users/rickk/sanbox/frontend/src/pages/BulkZoningImportPage.js")
