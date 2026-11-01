import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseReleaseTags } from '@/utils';

interface ReleaseBadgeRowProps {
  releaseName?: string;
  maxTags?: number;
  excludeResolutions?: boolean;
}

export const ReleaseBadgeRow: React.FC<ReleaseBadgeRowProps> = React.memo(
  ({ releaseName, maxTags = 4, excludeResolutions = false }) => {
    if (!releaseName) return null;

    const { tags } = parseReleaseTags(releaseName);
    const candidateTags = excludeResolutions
      ? tags.filter((t) => t.type !== 'resolution')
      : tags;
    const visibleTags = candidateTags.slice(0, maxTags);

    if (visibleTags.length === 0) return null;

    return (
      <View style={styles.container}>
        {visibleTags.map((tag, idx) => {
          let badgeStyle = styles.defaultBadge;
          let textStyle = styles.defaultText;

          if (tag.type === 'imax') {
            badgeStyle = styles.imaxBadge;
            textStyle = styles.imaxText;
          } else if (tag.type === 'remux') {
            badgeStyle = styles.remuxBadge;
            textStyle = styles.remuxText;
          } else if (tag.type === 'resolution') {
            if (tag.label.includes('4K')) {
              badgeStyle = styles.fourkBadge;
              textStyle = styles.fourkText;
            } else {
              badgeStyle = styles.hdBadge;
              textStyle = styles.hdText;
            }
          } else if (tag.type === 'hdr') {
            badgeStyle = styles.hdrBadge;
            textStyle = styles.hdrText;
          } else if (tag.type === 'audio') {
            badgeStyle = styles.audioBadge;
            textStyle = styles.audioText;
          } else if (tag.type === 'size') {
            badgeStyle = styles.sizeBadge;
            textStyle = styles.sizeText;
          }

          return (
            <View key={`${tag.label}_${idx}`} style={[styles.badgeBase, badgeStyle]}>
              <Text style={[styles.textBase, textStyle]}>{tag.label}</Text>
            </View>
          );
        })}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  badgeBase: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  textBase: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  defaultBadge: {
    backgroundColor: '#171924',
    borderColor: '#292e42',
  },
  defaultText: {
    color: '#94a3b8',
  },
  imaxBadge: {
    backgroundColor: '#271745',
    borderColor: '#6d28d9',
  },
  imaxText: {
    color: '#c084fc',
  },
  remuxBadge: {
    backgroundColor: '#3b1219',
    borderColor: '#991b1b',
  },
  remuxText: {
    color: '#f87171',
  },
  fourkBadge: {
    backgroundColor: '#33210a',
    borderColor: '#b45309',
  },
  fourkText: {
    color: '#fbbf24',
  },
  hdBadge: {
    backgroundColor: '#0c2238',
    borderColor: '#0284c7',
  },
  hdText: {
    color: '#38bdf8',
  },
  hdrBadge: {
    backgroundColor: '#0f1f3d',
    borderColor: '#2563eb',
  },
  hdrText: {
    color: '#60a5fa',
  },
  audioBadge: {
    backgroundColor: '#09291f',
    borderColor: '#059669',
  },
  audioText: {
    color: '#34d399',
  },
  sizeBadge: {
    backgroundColor: '#1a1f2c',
    borderColor: '#334155',
  },
  sizeText: {
    color: '#cbd5e1',
  },
});
