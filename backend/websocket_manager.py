"""
WebSocket Management Module for SoundDitect

This module handles WebSocket connections for real-time audio streaming
and communication between the frontend and backend.
"""

import asyncio
import logging
import json
import uuid
from typing import Dict, Set
from fastapi import WebSocket
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

class WebSocketManager:
    """
    Manager for WebSocket connections handling real-time audio streaming.
    
    Manages client connections, message broadcasting, and connection cleanup.
    """
    
    def __init__(self):
        # Store active connections: {client_id: websocket}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Store client metadata: {client_id: metadata}
        self.client_metadata: Dict[str, dict] = {}
        
        # Connection statistics
        self.total_connections = 0
        self.total_messages = 0
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket) -> str:
        """
        Register a new WebSocket connection.
        
        Args:
            websocket: The WebSocket connection to register
            
        Returns:
            Unique client ID for the connection
        """
        async with self._lock:
            client_id = str(uuid.uuid4())
            self.active_connections[client_id] = websocket
            self.client_metadata[client_id] = {
                "connected_at": asyncio.get_event_loop().time(),
                "messages_sent": 0,
                "messages_received": 0,
                "last_activity": asyncio.get_event_loop().time()
            }
            self.total_connections += 1
            
            logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")
            return client_id
    
    async def disconnect(self, client_id: str):
        """
        Remove a WebSocket connection.
        
        Args:
            client_id: ID of the client to disconnect
        """
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
                
                if client_id in self.client_metadata:
                    connection_duration = (
                        asyncio.get_event_loop().time() - 
                        self.client_metadata[client_id]["connected_at"]
                    )
                    logger.info(
                        f"Client {client_id} disconnected after {connection_duration:.2f}s. "
                        f"Remaining connections: {len(self.active_connections)}"
                    )
                    del self.client_metadata[client_id]
                else:
                    logger.info(f"Client {client_id} disconnected. Remaining connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, client_id: str) -> bool:
        """
        Send a message to a specific client.
        
        Args:
            message: Message to send
            client_id: Target client ID
            
        Returns:
            True if message was sent successfully
        """
        try:
            if client_id in self.active_connections:
                websocket = self.active_connections[client_id]
                await websocket.send_text(json.dumps(message))
                
                # Update statistics
                if client_id in self.client_metadata:
                    self.client_metadata[client_id]["messages_sent"] += 1
                    self.client_metadata[client_id]["last_activity"] = asyncio.get_event_loop().time()
                
                self.total_messages += 1
                return True
            else:
                logger.warning(f"Client {client_id} not found for personal message")
                return False
                
        except Exception as e:
            logger.error(f"Error sending message to client {client_id}: {e}")
            # Remove broken connection
            await self.disconnect(client_id)
            return False
    
    async def broadcast(self, message: dict, exclude_client: str = None):
        """
        Broadcast a message to all connected clients.
        
        Args:
            message: Message to broadcast
            exclude_client: Client ID to exclude from broadcast
        """
        if not self.active_connections:
            return
        
        # Create list of clients to avoid modifying dict during iteration
        clients_to_send = [
            client_id for client_id in self.active_connections.keys()
            if client_id != exclude_client
        ]
        
        # Send to all clients concurrently
        tasks = [
            self.send_personal_message(message, client_id)
            for client_id in clients_to_send
        ]
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            successful_sends = sum(1 for result in results if result is True)
            logger.debug(f"Broadcast sent to {successful_sends}/{len(tasks)} clients")
    
    async def disconnect_all(self):
        """Disconnect all active connections."""
        async with self._lock:
            client_ids = list(self.active_connections.keys())
            
            for client_id in client_ids:
                try:
                    websocket = self.active_connections[client_id]
                    await websocket.close()
                except Exception as e:
                    logger.error(f"Error closing connection {client_id}: {e}")
            
            self.active_connections.clear()
            self.client_metadata.clear()
            logger.info("All WebSocket connections closed")
    
    def get_connection_count(self) -> int:
        """Get the number of active connections."""
        return len(self.active_connections)
    
    def get_client_info(self, client_id: str) -> dict:
        """
        Get information about a specific client.
        
        Args:
            client_id: Client ID to get info for
            
        Returns:
            Dictionary with client information
        """
        if client_id in self.client_metadata:
            metadata = self.client_metadata[client_id].copy()
            metadata["is_connected"] = client_id in self.active_connections
            metadata["connection_duration"] = (
                asyncio.get_event_loop().time() - metadata["connected_at"]
            )
            return metadata
        else:
            return {"error": "Client not found"}
    
    def get_statistics(self) -> dict:
        """Get connection statistics."""
        current_time = asyncio.get_event_loop().time()
        
        active_durations = [
            current_time - metadata["connected_at"]
            for metadata in self.client_metadata.values()
        ]
        
        return {
            "active_connections": len(self.active_connections),
            "total_connections": self.total_connections,
            "total_messages": self.total_messages,
            "average_connection_duration": (
                sum(active_durations) / len(active_durations)
                if active_durations else 0
            ),
            "clients": {
                client_id: {
                    "messages_sent": metadata["messages_sent"],
                    "messages_received": metadata["messages_received"],
                    "connection_duration": current_time - metadata["connected_at"],
                    "last_activity": current_time - metadata["last_activity"]
                }
                for client_id, metadata in self.client_metadata.items()
            }
        }
    
    async def ping_all_clients(self):
        """Send ping to all connected clients to check connectivity."""
        ping_message = {
            "type": "ping",
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(ping_message)
    
    async def cleanup_stale_connections(self, timeout: float = 300.0):
        """
        Clean up connections that haven't been active for a specified timeout.
        
        Args:
            timeout: Timeout in seconds for considering a connection stale
        """
        current_time = asyncio.get_event_loop().time()
        stale_clients = []
        
        for client_id, metadata in self.client_metadata.items():
            if current_time - metadata["last_activity"] > timeout:
                stale_clients.append(client_id)
        
        for client_id in stale_clients:
            logger.info(f"Cleaning up stale connection: {client_id}")
            await self.disconnect(client_id)
    
    @asynccontextmanager
    async def connection_context(self, websocket: WebSocket):
        """
        Context manager for handling WebSocket connections.
        
        Args:
            websocket: WebSocket connection to manage
            
        Yields:
            Client ID for the connection
        """
        client_id = await self.connect(websocket)
        try:
            yield client_id
        finally:
            await self.disconnect(client_id)
    
    async def start_heartbeat(self, interval: float = 30.0):
        """
        Start a heartbeat task to maintain connections.
        
        Args:
            interval: Heartbeat interval in seconds
        """
        async def heartbeat_task():
            while True:
                try:
                    await self.ping_all_clients()
                    await self.cleanup_stale_connections()
                    await asyncio.sleep(interval)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Heartbeat error: {e}")
                    await asyncio.sleep(interval)
        
        # Start the heartbeat task
        heartbeat_task_handle = asyncio.create_task(heartbeat_task())
        return heartbeat_task_handle