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
  tag?: string;
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
  tag?: string;
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
    tag,
  } = data;

  const websiteEventData = [];
  const eventsData = [];

  if (eventBatchData) {
    for (const eventData of eventBatchData) {
      const websiteEventId = uuid();

      websiteEventData.push({
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
        tag,
      });

      eventsData.push({
        websiteId,
        sessionId,
        visitId,
        eventId: websiteEventId,
        urlPath: urlPath?.substring(0, URL_LENGTH),
        eventName: eventName?.substring(0, EVENT_NAME_LENGTH),
        eventData,
      });
    }
  } else {
    const websiteEventId = uuid();

    websiteEventData.push({
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
      tag,
    });

    eventsData.push({
      websiteId,
      sessionId,
      visitId,
      eventId: websiteEventId,
      urlPath: urlPath?.substring(0, URL_LENGTH),
      eventName: eventName?.substring(0, EVENT_NAME_LENGTH),
      eventData,
    });
  }

  const websiteEvents = prisma.client.websiteEvent.createMany({
    data: websiteEventData,
  });

  if (eventData || eventBatchData) {
    await saveEventData(eventsData);
  }

  return websiteEvents;
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
  tag?: string;
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
    tag,
    ...args
  } = data;
  const { insert, getUTCString } = clickhouse;
  const { sendMessages } = kafka;
  const createdAt = getUTCString();

  const websiteEventData = [];
  const eventsData = [];

  if (eventBatchData) {
    for (const eventData of eventBatchData) {
      const websiteEventId = uuid();

      websiteEventData.push({
        ...args,
        website_id: websiteId,
        session_id: sessionId,
        visit_id: visitId,
        event_id: websiteEventId,
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
        tag: tag,
        created_at: createdAt,
      });

      eventsData.push({
        websiteId,
        sessionId,
        visitId,
        eventId: websiteEventId,
        urlPath: urlPath?.substring(0, URL_LENGTH),
        eventName: eventName?.substring(0, EVENT_NAME_LENGTH),
        eventData,
        createdAt,
      });
    }
  } else {
    const websiteEventId = uuid();

    websiteEventData.push({
      ...args,
      website_id: websiteId,
      session_id: sessionId,
      visit_id: visitId,
      event_id: websiteEventId,
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
      tag: tag,
      created_at: createdAt,
    });

    eventsData.push({
      websiteId,
      sessionId,
      visitId,
      eventId: websiteEventId,
      urlPath: urlPath?.substring(0, URL_LENGTH),
      eventName: eventName?.substring(0, EVENT_NAME_LENGTH),
      eventData,
      createdAt,
    });
  }

  if (kafka.enabled) {
    await sendMessages('event', websiteEventData);
  } else {
    await insert('website_event', websiteEventData);
  }

  if (eventData || eventBatchData) {
    await saveEventData(eventsData);
  }

  return data;
}
