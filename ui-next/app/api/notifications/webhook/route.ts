import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notification-service'
import {
  clearNotificationEvents,
  deleteNotificationEvent,
  getNotificationEventSummary,
  listNotificationEvents,
} from '@/lib/notification-inbox'

const notificationService = new NotificationService()

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const notifications = await listNotificationEvents(Number.isFinite(limit) ? limit : 50);
    const summary = await getNotificationEventSummary();

    return NextResponse.json({
      notifications,
      summary,
    });
  } catch (error) {
    console.error('Failed to list alert webhook notifications:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', notifications: [] },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const deleteAll = request.nextUrl.searchParams.get('all') === 'true';

    if (deleteAll) {
      await clearNotificationEvents();
      return NextResponse.json({
        success: true,
        deleted: 'all',
        summary: await getNotificationEventSummary(),
      });
    }

    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Notification id is required' }, { status: 400 });
    }

    const deleted = await deleteNotificationEvent(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deleted: id,
      summary: await getNotificationEventSummary(),
    });
  } catch (error) {
    console.error('Failed to delete alert webhook notification:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const alertData = await request.json()
    console.log('Received alert webhook:', alertData)

    const result = await notificationService.processAlertWebhook(alertData)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Alert webhook processing failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
