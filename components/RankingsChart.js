import React, { useState, useEffect, useMemo } from 'react';
import { useSpring, animated } from 'react-spring';
import classNames from 'classnames';
import { get } from 'lib/web';
import { percentFilter } from 'lib/filters';
import styles from './RankingsChart.module.css';

export default function RankingsChart({
  title,
  websiteId,
  startDate,
  endDate,
  type,
  heading,
  className,
  dataFilter,
  animate = true,
  onDataLoad = () => {},
}) {
  const [data, setData] = useState();

  const rankings = useMemo(() => {
    if (data) {
      return (dataFilter ? dataFilter(data) : data).filter((e, i) => i < 10);
    }
    return [];
  }, [data]);

  async function loadData() {
    const data = await get(`/api/website/${websiteId}/rankings`, {
      start_at: +startDate,
      end_at: +endDate,
      type,
    });

    const updated = percentFilter(data);

    setData(updated);
    onDataLoad(updated);
  }

  useEffect(() => {
    if (websiteId) {
      loadData();
    }
  }, [websiteId, startDate, endDate, type]);

  if (!data) {
    return null;
  }

  return (
    <div className={classNames(styles.container, className)}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        <div className={styles.heading}>{heading}</div>
      </div>
      {rankings.map(({ x, y, z }) =>
        animate ? (
          <AnimatedRow key={x} label={x} value={y} percent={z} />
        ) : (
          <Row key={x} label={x} value={y} percent={z} />
        ),
      )}
    </div>
  );
}

const Row = ({ label, value, percent }) => (
  <div className={styles.row}>
    <div className={styles.label}>{label}</div>
    <div className={styles.value}>{value.toFixed(0)}</div>
    <div className={styles.percent}>
      <div>{`${percent.toFixed(0)}%`}</div>
      <div className={styles.bar} style={{ width: percent }} />
    </div>
  </div>
);

const AnimatedRow = ({ label, value, percent }) => {
  const props = useSpring({ width: percent, y: value, from: { width: 0, y: 0 } });

  return (
    <div className={styles.row}>
      <div className={styles.label}>{label}</div>
      <animated.div className={styles.value}>{props.y.interpolate(n => n.toFixed(0))}</animated.div>
      <div className={styles.percent}>
        <animated.div>{props.width.interpolate(n => `${n.toFixed(0)}%`)}</animated.div>
        <animated.div className={styles.bar} style={{ width: props.width }} />
      </div>
    </div>
  );
};