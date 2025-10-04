#!/usr/bin/env python3
"""
Script to transform BulkZoningImportPage.js to use custom themed components
instead of Bootstrap components.
"""

import re

def transform_file(input_path, output_path):
    with open(input_path, 'r') as f:
        content = f.read()

    # 1. Update imports
    content = re.sub(
        r'import React, \{ useState, useEffect, useContext, useCallback \} from "react";\nimport \{ Button, Form, Alert, Card, Spinner, Badge, Tab, Tabs, Modal, Table \} from "react-bootstrap";',
        'import React, { useState, useEffect, useContext, useCallback } from "react";',
        content
    )

    content = re.sub(
        r'import "handsontable/dist/handsontable\.full\.css";',
        'import { useTheme } from "../context/ThemeContext";\nimport "handsontable/dist/handsontable.full.css";\nimport "../styles/bulk-zoning-import.css";',
        content
    )

    # 2. Add theme hook to main component
    content = re.sub(
        r'const BulkZoningImportPage = \(\) => \{\n  const \{ config \} = useContext\(ConfigContext\);',
        'const BulkZoningImportPage = () => {\n  const { config } = useContext(ConfigContext);\n  const { theme } = useTheme();',
        content
    )

    # 3. Replace Bootstrap Modal with custom modal in DuplicateConflictResolver
    # Modal opening
    content = re.sub(
        r'<Modal show=\{true\} size="xl" onHide=\{onCancel\}>',
        '<div className="custom-modal-overlay" onClick={onCancel}>\n      <div className="custom-modal custom-modal-xl" onClick={(e) => e.stopPropagation()}>',
        content
    )

    # Modal Header
    content = re.sub(
        r'<Modal\.Header closeButton>\s*<Modal\.Title>',
        '<div className="custom-modal-header">\n          <h3 className="custom-modal-title">',
        content
    )

    content = re.sub(
        r'</Modal\.Title>\s*</Modal\.Header>',
        '</h3>\n          <button className="custom-modal-close" onClick={onCancel}>&times;</button>\n        </div>',
        content
    )

    # Modal Body
    content = re.sub(r'<Modal\.Body>', '<div className="custom-modal-body">', content)
    content = re.sub(r'</Modal\.Body>', '</div>', content)

    # Modal Footer
    content = re.sub(r'<Modal\.Footer>', '<div className="custom-modal-footer">', content)
    content = re.sub(r'</Modal\.Footer>', '</div>', content)

    # Modal closing
    content = re.sub(
        r'</Modal>',
        '</div>\n    </div>',
        content
    )

    # 4. Replace Alert components
    content = re.sub(r'<Alert variant="info">', '<div className="custom-alert custom-alert-info">', content)
    content = re.sub(r'<Alert variant="warning">', '<div className="custom-alert custom-alert-warning">', content)
    content = re.sub(r'<Alert variant="danger">', '<div className="custom-alert custom-alert-danger">', content)
    content = re.sub(r'<Alert variant="success"(.*?)>', r'<div className="custom-alert custom-alert-success"\1>', content)
    content = re.sub(r'</Alert>', '</div>', content)

    # 5. Replace Badge components
    content = re.sub(r'<Badge variant="secondary"(.*?)>', r'<span className="custom-badge custom-badge-secondary"\1>', content)
    content = re.sub(r'<Badge variant="primary">', '<span className="custom-badge custom-badge-primary">', content)
    content = re.sub(r'<Badge variant="success">', '<span className="custom-badge custom-badge-success">', content)
    content = re.sub(r'<Badge variant="warning">', '<span className="custom-badge custom-badge-warning">', content)
    content = re.sub(r'<Badge variant="danger">', '<span className="custom-badge custom-badge-danger">', content)
    content = re.sub(r'</Badge>', '</span>', content)

    # 6. Replace Table components
    content = re.sub(r'<Table striped bordered hover size="sm">', '<table className="custom-table custom-table-sm">', content)
    content = re.sub(r'<Table(.*?)>', r'<table className="custom-table"\1>', content)
    content = re.sub(r'</Table>', '</table>', content)

    # 7. Replace Card components
    content = re.sub(r'<Card>', '<div className="custom-card">', content)
    content = re.sub(r'<Card className="mb-3">', '<div className="custom-card">', content)
    content = re.sub(r'</Card>', '</div>', content)
    content = re.sub(r'<Card\.Header(.*?)>', r'<div className="custom-card-header"\1>', content)
    content = re.sub(r'</Card\.Header>', '</div>', content)
    content = re.sub(r'<Card\.Body>', '<div className="custom-card-body">', content)
    content = re.sub(r'</Card\.Body>', '</div>', content)

    # 8. Replace Form components
    content = re.sub(r'<Form\.Group className="mb-3">', '<div className="form-group">', content)
    content = re.sub(r'<Form\.Group(.*?)>', r'<div className="form-group"\1>', content)
    content = re.sub(r'</Form\.Group>', '</div>', content)

    content = re.sub(r'<Form\.Label><strong>(.*?)</strong></Form\.Label>', r'<label className="form-label">\1</label>', content)
    content = re.sub(r'<Form\.Label>(.*?)</Form\.Label>', r'<label className="form-label">\1</label>', content)

    content = re.sub(r'<Form\.Select', '<select className="form-select"', content)
    content = re.sub(r'</Form\.Select>', '</select>', content)

    content = re.sub(r'<Form\.Control', '<textarea className="form-textarea"', content)
    content = re.sub(r'</Form\.Control>', '</textarea>', content)

    content = re.sub(r'<Form\.Check\s+type="checkbox"', '<div className="form-check"><input type="checkbox" className="form-check-input"', content)
    content = re.sub(r'<Form\.Check\s+type="radio"', '<input type="radio" className="form-check-input"', content)
    content = re.sub(r'label="(.*?)"', r'id="\1-check" /><label className="form-check-label" htmlFor="\1-check">\1</label></div>', content)

    # 9. Replace Button components
    content = re.sub(r'<Button variant="primary"(.*?)>', r'<button className="btn btn-primary"\1>', content)
    content = re.sub(r'<Button variant="secondary"(.*?)>', r'<button className="btn btn-secondary"\1>', content)
    content = re.sub(r'<Button variant="outline-primary"(.*?)>', r'<button className="btn btn-outline-primary"\1>', content)
    content = re.sub(r'<Button variant="outline-secondary"(.*?)>', r'<button className="btn btn-outline-secondary"\1>', content)
    content = re.sub(r'<Button variant="outline-danger"(.*?)>', r'<button className="btn btn-outline-danger"\1>', content)
    content = re.sub(r'<Button variant="outline-info"(.*?)>', r'<button className="btn btn-outline-info"\1>', content)
    content = re.sub(r'<Button variant="outline-success"(.*?)>', r'<button className="btn btn-outline-success"\1>', content)
    content = re.sub(r'</Button>', '</button>', content)

    # Replace size="sm" with btn-sm class
    content = re.sub(r'<button className="btn (.*?)" size="sm"', r'<button className="btn \1 btn-sm"', content)

    # 10. Replace Spinner components
    content = re.sub(r'<Spinner size="sm" className="me-1" />', '<span className="custom-spinner me-1"></span>', content)
    content = re.sub(r'<Spinner(.*?)/>', r'<span className="custom-spinner"\1></span>', content)
    content = re.sub(r'<div className="spinner-border text-info"(.*?)>', r'<div className="custom-spinner custom-spinner-lg"\1>', content)
    content = re.sub(r'<div className="spinner-border text-success"(.*?)>', r'<div className="custom-spinner custom-spinner-lg"\1>', content)
    content = re.sub(r'<span className="visually-hidden">Loading...</span>', '', content)

    # 11. Replace Tabs components
    content = re.sub(
        r'<Tabs activeKey=\{activeTab\} onSelect=\{\(k\) => setActiveTab\(k\)\} className="mb-3">',
        '<div className="custom-tabs">',
        content
    )
    content = re.sub(r'<Tab eventKey="files" title="File Upload">', '<button className={`custom-tab ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>File Upload</button></div><div className="mb-3">{activeTab === "files" && (', content)
    content = re.sub(r'</Tab>\s*<Tab eventKey="text" title="Paste Text">', ')}{activeTab === "text" && (<button className={`custom-tab ${activeTab === "text" ? "active" : ""}`} onClick={() => setActiveTab("text")}>Paste Text</button>', content)
    content = re.sub(r'</Tab>\s*</Tabs>', ')}</div>', content)

    # 12. Update main container with theme class
    content = re.sub(
        r'<div className="container-fluid mt-4"',
        '<div className={`bulk-zoning-container theme-${theme}`}><div className="bulk-zoning-content"',
        content
    )

    # Fix template literal
    content = content.replace('className={`bulk-zoning-container theme-${theme}`}', 'className={`bulk-zoning-container theme-${theme}`}')

    # 13. Add page header
    content = re.sub(
        r'<div className=\{`bulk-zoning-container theme-\$\{theme\}`\}><div className="bulk-zoning-content"',
        r'''<div className={`bulk-zoning-container theme-${theme}`}>
      {/* Page Header */}
      <div className="bulk-zoning-header">
        <h1 className="bulk-zoning-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <path d="M16 13H8"/>
            <path d="M16 17H8"/>
            <path d="M10 9H8"/>
          </svg>
          Bulk Alias & Zone Import
        </h1>
        <p className="bulk-zoning-description">
          Import multiple files containing alias and zone data automatically. Supports Cisco show tech-support files, device-alias, fcalias, and zone configurations.
        </p>
      </div>

      <div className="bulk-zoning-content"''',
        content
    )

    # 14. Fix table row class for selected state
    content = re.sub(r"className=\{isSelected \? 'table-success' : ''\}", r'className={isSelected ? "selected" : ""}', content)

    # 15. Fix overlays - change white background to themed
    content = re.sub(
        r"background: 'white'",
        "background: 'var(--table-bg)'",
        content
    )

    # 16. Fix text colors in overlays
    content = re.sub(r'className="text-info"', 'style={{color: "var(--link-text)"}}', content)
    content = re.sub(r'className="text-success"', 'style={{color: "var(--success-text)"}}', content)
    content = re.sub(r'className="text-muted"', 'className="text-muted"', content)

    # 17. Add closing divs at the end
    content = re.sub(
        r'(</div>\s*{/\* Duplicate Conflict Resolution Modal \*/})',
        r'</div>\n      \1',
        content
    )

    with open(output_path, 'w') as f:
        f.write(content)

    print(f"✅ Transformation complete! Output written to {output_path}")

if __name__ == "__main__":
    input_file = "/Users/rickk/sanbox/frontend/src/pages/BulkZoningImportPage.js"
    output_file = "/Users/rickk/sanbox/frontend/src/pages/BulkZoningImportPage.js"
    transform_file(input_file, output_file)
