

import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const ScriptsPage = () => {
  const navigate = useNavigate();

  return (
    <Container className="mt-5">
      <h1 className="mb-4 text-center">Script Builder</h1>
      <Row>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>DS8000 DSCLI Scripts</Card.Title>
              <Card.Text>
                Build and customize DSCLI scripts for IBM DS8000 storage systems.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/ds8000")}
              >
                Start DS8000 Script Builder
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>FlashSystem Scripts</Card.Title>
              <Card.Text>
                Generate scripts for IBM FlashSystem storage management and automation.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/flashsystem")}
              >
                Start FlashSystem Script Builder
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>SAN Zoning Scripts</Card.Title>
              <Card.Text>
                Create SAN zoning scripts to simplify fabric configuration.
              </Card.Text>
              <Button
                variant="primary"
                onClick={() => navigate("/scripts/zoning")}
              >
                Start SAN Zoning Script Builder
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ScriptsPage;