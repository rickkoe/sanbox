#!/usr/bin/env python3
"""
Fix remaining Bootstrap components and malformed tab structure
"""

import re

def fix_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Fix the tabs structure - find and replace the entire tabs section
    # The tabs section should have proper structure with both tabs visible and conditional content rendering

    old_tabs = r'''              {/\* Import Method Tabs \*/}
              <div className="custom-tabs">
                <button className=\{`custom-tab \$\{activeTab === "files" \? "active" : ""\}`\} onClick=\{\(\) => setActiveTab\("files"\)\}>File Upload</button></div><div className="mb-3">\{activeTab === "files" && \(
                  {/\* Drag and Drop Zone \*/}'''

    new_tabs = '''              {/* Import Method Tabs */}
              <div className="custom-tabs">
                <button className={`custom-tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>File Upload</button>
                <button className={`custom-tab ${activeTab === "text" ? "active" : ""}`} onClick={() => setActiveTab("text")}>Text Paste</button>
              </div>
              <div className="mb-3">
                {activeTab === "files" && (
                  <div>
                  {/* Drag and Drop Zone */}'''

    content = content.replace(old_tabs, new_tabs)

    # Fix remaining Button components
    content = re.sub(r'<Button\s+variant="outline-primary"', '<button className="btn btn-outline-primary"', content)
    content = re.sub(r'<Button\s+variant="primary"', '<button className="btn btn-primary"', content)
    content = re.sub(r'<Button\s+variant="outline-success"', '<button className="btn btn-outline-success"', content)
    content = re.sub(r'<Button\s*', '<button className="btn btn-primary" ', content)

    # Fix remaining Alert components
    content = re.sub(r'<Alert variant="danger"', '<div className="custom-alert custom-alert-danger"', content)

    # Fix duplicate className attributes
    content = re.sub(r'className="([^"]+)"\s+className="([^"]+)"', r'className="\1 \2"', content)

    # Fix closing tags
    content = re.sub(r'</Tab>\s*<Tab eventKey="text" title="Text Paste">', '', content)
    content = re.sub(r'</Tab>', '', content)
    content = re.sub(r'\)\}</div>', ')}\n                </div>\n              )}', content)

    # Fix drag-drop-zone styling
    old_drag_drop = r'''                  <div
                    className=\{`border-2 border-dashed rounded p-4 text-center mb-3 \$\{
                      dragActive \? "border-primary bg-light" : "border-secondary"
                    \}`\}'''

    new_drag_drop = '''                  <div
                    className={`drag-drop-zone ${dragActive ? "active" : ""}`}'''

    content = content.replace(old_drag_drop, new_drag_drop)

    # Remove as="textarea" attribute which is bootstrap specific
    content = re.sub(r'\s+as="textarea"', '', content)

    with open(file_path, 'w') as f:
        f.write(content)

    print("✅ Fixed remaining issues!")

if __name__ == "__main__":
    fix_file("/Users/rickk/sanbox/frontend/src/pages/BulkZoningImportPage.js")
