import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const FlashsystemScriptsPage = () => {
  const navigate = useNavigate();
  return (
    <Container className="mt-5">
      <h1 className="mb-4 text-center">FlashSystem Script Builder</h1>
      <Row>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Volume Provisioning</Card.Title>
              <Card.Text>
                Automate volume creation, expansion, and mapping on IBM FlashSystem arrays.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/flashsystem/provisioning")}
              >
                Go to Provisioning
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>FlashCopy Operations</Card.Title>
              <Card.Text>
                Generate scripts for configuring and managing FlashCopy relationships.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/flashsystem/flashcopy")}
              >
                Go to FlashCopy
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Replication & Snapshot</Card.Title>
              <Card.Text>
                Create scripts for synchronous/asynchronous replication and snapshot management.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/flashsystem/replication")}
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

export default FlashsystemScriptsPage;
