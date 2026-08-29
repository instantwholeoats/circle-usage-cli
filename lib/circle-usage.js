'use strict';

function monthRange(startTime, now = new Date()) {
  if (!startTime) {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
    };
  }

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    throw new TypeError(`Invalid STARTTIME: ${startTime}`);
  }

  return {
    start,
    end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
  };
}

class CircleUsage {
  constructor(env = {}) {
    const range = monthRange(env.STARTTIME, env.NOW);

    this._circleToken = env.CIRCLE_TOKEN;
    this._maxMinute = env.MAX_MINUTE;
    this._page = Number(env.PAGE || 100);
    this._print = env.OUTPUT_FUNCTION || console.log;
    this._fetch = env.FETCH_FUNCTION || globalThis.fetch;
    this._startTime = range.start;
    this._endTime = range.end;

    if (!Number.isInteger(this._page) || this._page < 1 || this._page > 100) {
      throw new RangeError('PAGE must be an integer from 1 to 100');
    }
    if (typeof this._fetch !== 'function') {
      throw new Error('circle-usage requires Node.js 18 or newer');
    }
  }

  _generateRequest(offset) {
    const url = new URL('https://circleci.com/api/v1.1/recent-builds');
    url.searchParams.set('limit', this._page);
    url.searchParams.set('offset', offset);

    return {
      url,
      options: {
        headers: {
          Accept: 'application/json',
          'Circle-Token': this._circleToken,
        },
      },
    };
  }

  async _getRecentBuilds() {
    if (!this._circleToken) {
      throw new Error('CIRCLE_TOKEN is required');
    }

    let offset = 0;
    let secondSum = 0;

    for (;;) {
      const request = this._generateRequest(offset);
      const response = await this._fetch(request.url, request.options);
      if (!response.ok) {
        throw new Error(`CircleCI API request failed: HTTP ${response.status}`);
      }

      const responseData = await response.json();
      if (!Array.isArray(responseData)) {
        throw new TypeError('CircleCI API returned an unexpected response');
      }
      if (responseData.length === 0) {
        break;
      }

      for (const build of responseData) {
        const queuedAt = new Date(build.queued_at);
        const buildTime = Number(build.build_time_millis);
        if (
          !Number.isNaN(queuedAt.getTime()) &&
          Number.isFinite(buildTime) &&
          queuedAt > this._startTime &&
          queuedAt < this._endTime
        ) {
          secondSum += buildTime / 1000;
        }
      }

      offset += this._page;
    }

    return secondSum;
  }

  async run() {
    const second = await this._getRecentBuilds();
    const minute = second / 60;
    if (this._maxMinute) {
      this._print(
        `Circle CI usage: ${Math.floor(minute)}min/${this._maxMinute}min (${Math.floor(
          (minute * 100) / this._maxMinute,
        )}%)`,
      );
    } else {
      this._print(`Circle CI usage: ${Math.floor(minute)}min`);
    }
  }
}

module.exports = CircleUsage;
