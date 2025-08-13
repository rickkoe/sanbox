import React from "react";
import { Form, Button, Spinner } from "react-bootstrap";

const TextPasteTab = ({
  textInput,
  setTextInput,
  selectedFabric,
  loading,
  handleTextPaste
}) => {
  return (
    <Form.Group className="mb-3">
      <Form.Label><strong>Paste Text Content</strong></Form.Label>
      <Form.Control
        as="textarea"
        rows={12}
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder="Paste your alias and zone configuration data here (device-alias, fcalias, zones, or tech-support output)..."
        style={{
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          fontSize: "13px",
        }}
      />
      <div className="d-flex gap-2 mt-2">
        <Button
          variant="primary"
          onClick={handleTextPaste}
          disabled={!selectedFabric || !textInput.trim() || loading}
        >
          {loading ? (
            <>
              <Spinner size="sm" className="me-1" />
              Processing...
            </>
          ) : (
            "Process Text"
          )}
        </Button>
        <Button variant="outline-secondary" onClick={() => setTextInput("")}>
          Clear
        </Button>
      </div>
    </Form.Group>
  );
};

export default TextPasteTab;