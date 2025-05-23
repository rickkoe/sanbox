

import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const DS8000ScriptsPage = () => {
  const navigate = useNavigate();
  return (
    <Container className="mt-5">
      <h1 className="mb-4 text-center">DS8000 Script Builder</h1>
      <Row>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Volume Provisioning</Card.Title>
              <Card.Text>
                Automate the creation and management of volumes on DS8000 systems. Generate scripts for provisioning new storage volumes efficiently.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/ds8000/provisioning")}
              >
                Go to Provisioning
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Safeguarded Copy</Card.Title>
              <Card.Text>
                Create and manage safeguarded copies for data protection on DS8000. Build scripts to automate copy operations and retention.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/ds8000/safeguarded-copy")}
              >
                Go to Safeguarded Copy
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Replication &amp; Copy Services</Card.Title>
              <Card.Text>
                Configure replication and advanced copy services. Generate scripts for Metro Mirror, Global Mirror, and FlashCopy operations.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/ds8000/replication")}
              >
                Go to Replication
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default DS8000ScriptsPage;