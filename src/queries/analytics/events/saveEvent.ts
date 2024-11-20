import clickhouse from 'lib/clickhouse';
import { EVENT_NAME_LENGTH, EVENT_TYPE, PAGE_TITLE_LENGTH, URL_LENGTH } from 'lib/constants';
import { uuid } from 'lib/crypto';
import { CLICKHOUSE, PRISMA, runQuery } from 'lib/db';
import kafka from 'lib/kafka';
import prisma from 'lib/prisma';
import { saveEventData } from './saveEventData';

export async function saveEvent(args: {
  websiteId: string;
  sessionId: string;
  visitId: string;
  urlPath: string;
  urlQuery?: string;
  referrerPath?: string;
  referrerQuery?: string;
  referrerDomain?: string;
  pageTitle?: string;
  eventName?: string;
  eventData?: any;
  eventBatchData?: any[];
  hostname?: string;
  browser?: string;
  os?: string;
  device?: string;
  screen?: string;
  language?: string;
  country?: string;
  subdivision1?: string;
  subdivision2?: string;
  city?: string;
}) {
  return runQuery({
    [PRISMA]: () => relationalQuery(args),
    [CLICKHOUSE]: () => clickhouseQuery(args),
  });
}

async function relationalQuery(data: {
  websiteId: string;
  sessionId: string;
  visitId: string;
  urlPath: string;
  urlQuery?: string;
  referrerPath?: string;
  referrerQuery?: string;
  referrerDomain?: string;
  pageTitle?: string;
  eventName?: string;
  eventData?: any;
  eventBatchData?: Array<any>;
}) {
  const {
    websiteId,
    sessionId,
    visitId,
    urlPath,
    urlQuery,
    referrerPath,
    referrerQuery,
    referrerDomain,
    eventName,
    eventData,
    pageTitle,
    eventBatchData,
  } = data;
  const websiteEventId = uuid();

  const websiteEvent = prisma.client.websiteEvent.create({
    data: {
      id: websiteEventId,
      websiteId,
      sessionId,
      visitId,
      urlPath: urlPath?.substring(0, URL_LENGTH),
      urlQuery: urlQuery?.substring(0, URL_LENGTH),
      referrerPath: referrerPath?.substring(0, URL_LENGTH),
      referrerQuery: referrerQuery?.substring(0, URL_LENGTH),
      referrerDomain: referrerDomain?.substring(0, URL_LENGTH),
      pageTitle: pageTitle?.substring(0, PAGE_TITLE_LENGTH),
      eventType: eventName ? EVENT_TYPE.customEvent : EVENT_TYPE.pageView,
      eventName: eventName ? eventName?.substring(0, EVENT_NAME_LENGTH) : null,
    },
  });

  if (eventData || eventBatchData) {
    await saveEventData({
      websiteId,
      sessionId,
      visitId,
      eventId: websiteEventId,
      urlPath: urlPath?.substring(0, URL_LENGTH),
      eventName: eventName?.substring(0, EVENT_NAME_LENGTH),
      eventData,
      eventBatchData,
    });
  }

  return websiteEvent;
}

async function clickhouseQuery(data: {
  websiteId: string;
  sessionId: string;
  visitId: string;
  urlPath: string;
  urlQuery?: string;
  referrerPath?: string;
  referrerQuery?: string;
  referrerDomain?: string;
  pageTitle?: string;
  eventName?: string;
  eventData?: any;
  eventBatchData?: any[];
  hostname?: string;
  browser?: string;
  os?: string;
  device?: string;
  screen?: string;
  language?: string;
  country?: string;
  subdivision1?: string;
  subdivision2?: string;
  city?: string;
}) {
  const {
    websiteId,
    sessionId,
    visitId,
    urlPath,
    urlQuery,
    referrerPath,
    referrerQuery,
    referrerDomain,
    pageTitle,
    eventName,
    eventData,
    eventBatchData,
    country,
    subdivision1,
    subdivision2,
    city,
    ...args
  } = data;
  const { insert, getUTCString } = clickhouse;
  const { sendMessage } = kafka;
  const eventId = uuid();
  const createdAt = getUTCString();

  const message = {
    ...args,
    website_id: websiteId,
    session_id: sessionId,
    visit_id: visitId,
    event_id: eventId,
    country: country,
    subdivision1:
      country && subdivision1
        ? subdivision1.includes('-')
          ? subdivision1
          : `${country}-${subdivision1}`
        : null,
    subdivision2: subdivision2,
    city: city,
    url_path: urlPath?.substring(0, URL_LENGTH),
    url_query: urlQuery?.substring(0, URL_LENGTH),
    referrer_path: referrerPath?.substring(0, URL_LENGTH),
    referrer_query: referrerQuery?.substring(0, URL_LENGTH),
    referrer_domain: referrerDomain?.substring(0, URL_LENGTH),
    page_title: pageTitle?.substring(0, PAGE_TITLE_LENGTH),
    event_type: eventName ? EVENT_TYPE.customEvent : EVENT_TYPE.pageView,
    event_name: eventName ? eventName?.substring(0, EVENT_NAME_LENGTH) : null,
    created_at: createdAt,
  };

  if (kafka.enabled) {
    await sendMessage('event', message);
  } else {
    await insert('website_event', [message]);
  }

  if (eventData || eventBatchData) {
    await saveEventData({
      websiteId,
      sessionId,
      visitId,
      eventId,
      urlPath: urlPath?.substring(0, URL_LENGTH),
      eventName: eventName?.substring(0, EVENT_NAME_LENGTH),
      eventData,
      eventBatchData,
      createdAt,
    });
  }

  return data;
}
