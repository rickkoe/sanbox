import React from "react";
import { Tabs, Tab } from "react-bootstrap";
import FileUploadZone from "./FileUploadZone";
import TextPasteTab from "./TextPasteTab";

const ImportTabs = ({
  activeTab,
  setActiveTab,
  dragActive,
  selectedFabric,
  handleDrag,
  handleDrop,
  handleFileSelect,
  textInput,
  setTextInput,
  loading,
  handleTextPaste
}) => {
  return (
    <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
      <Tab eventKey="files" title="File Upload">
        <FileUploadZone
          dragActive={dragActive}
          selectedFabric={selectedFabric}
          handleDrag={handleDrag}
          handleDrop={handleDrop}
          handleFileSelect={handleFileSelect}
        />
      </Tab>

      <Tab eventKey="text" title="Text Paste">
        <TextPasteTab
          textInput={textInput}
          setTextInput={setTextInput}
          selectedFabric={selectedFabric}
          loading={loading}
          handleTextPaste={handleTextPaste}
        />
      </Tab>
    </Tabs>
  );
};

export default ImportTabs;