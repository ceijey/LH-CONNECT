import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';

// Store active SSE connections: key is userId, value is set of controller objects
interface ControllerWithCleanup {
  controller: ReadableStreamController<any>;
  interval: NodeJS.Timeout;
}

const activeConnections: Map<string, Set<ControllerWithCleanup>> = new Map();

export async function GET(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  // Create SSE response
  const stream = new ReadableStream({
    start(controller) {
      // Create keep-alive interval
      const interval = setInterval(() => {
        try {
          controller.enqueue(': keep-alive\n\n');
        } catch (e) {
          // Connection is closed, cleanup will happen in cancel()
        }
      }, 30000);

      const controllerWithCleanup: ControllerWithCleanup = {
        controller,
        interval,
      };

      // Add this controller to the active connections
      if (!activeConnections.has(userId)) {
        activeConnections.set(userId, new Set());
      }
      activeConnections.get(userId)!.add(controllerWithCleanup);

      // Send initial connection message
      try {
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      } catch (e) {
        clearInterval(interval);
      }
    },
    cancel() {
      const connections = activeConnections.get(userId);
      if (connections) {
        connections.forEach((item) => {
          clearInterval(item.interval);
        });
        activeConnections.delete(userId);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

// Export function to notify specific user(s) about message updates
export function notifyUserOfMessageUpdate(userId: string) {
  const connections = activeConnections.get(userId);
  if (connections && connections.size > 0) {
    const toRemove: ControllerWithCleanup[] = [];
    
    connections.forEach((item) => {
      try {
        item.controller.enqueue(`data: ${JSON.stringify({ type: 'message_update' })}\n\n`);
      } catch (e) {
        // Connection is broken, mark for removal
        clearInterval(item.interval);
        toRemove.push(item);
      }
    });

    // Remove broken connections
    toRemove.forEach((item) => {
      connections.delete(item);
    });

    // Clean up empty connection sets
    if (connections.size === 0) {
      activeConnections.delete(userId);
    }
  }
}

// Export function to notify all connected users
export function notifyAllUsers(message: any) {
  activeConnections.forEach((connections, userId) => {
    const toRemove: ControllerWithCleanup[] = [];
    
    connections.forEach((item) => {
      try {
        item.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
      } catch (e) {
        clearInterval(item.interval);
        toRemove.push(item);
      }
    });

    toRemove.forEach((item) => {
      connections.delete(item);
    });

    if (connections.size === 0) {
      activeConnections.delete(userId);
    }
  });
}
