#!/bin/bash
while ! curl -s http://localhost:3000 > /dev/null; do
  echo "Waiting for frontend..."
  sleep 2
done
echo "Frontend is up!"
