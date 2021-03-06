export function ruleStrong(id, type, strongTypes, cache) {
  return {
    conditions: {
      any: [
        {
          fact: "enemyPokemon",
          path: `$.${id}.types`,
          operator: "contains",
          value: type,
        },
      ],
    },
    event: {
      type: "strong",
      params: {
        id: id,
        types: strongTypes,
      },
    },

    priority: 100,

    onSuccess: async function (event, almanac) {
      const counterTypes = event.params.types;
      counterTypes.forEach((type) => {
        const prev = cache.strongCounter[type] ?? 0;
        cache.strongCounter[type] = prev + 1;
      });
      // const counter = await almanac.factValue("counter");
      //console.log(cache);
    },
  };
}

export function ruleWeak(id, type, weakTypes, cache) {
  return {
    conditions: {
      any: [
        {
          fact: "enemyPokemon",
          path: `$.${id}.types`,
          operator: "contains",
          value: type,
        },
      ],
    },
    event: {
      type: "weak",
      params: {
        id: id,
        types: weakTypes,
      },
    },

    priority: 100,

    onSuccess: async function (event, almanac) {
      const counterTypes = event.params.types;
      counterTypes.forEach((type) => {
        const prev = cache.weakCounter[type] ?? 0;
        cache.weakCounter[type] = prev + 1;
      });
      // const counter = await almanac.factValue("counter");
      //console.log(cache);
    },
  };
}

export function ruleCounters(cache) {
  return {
    conditions: {
      any: [
        {
          fact: "returnCounters",
          operator: "equal",
          value: true,
        },
      ],
    },
    event: {
      type: "counters",
      params: {
        strong: cache.strongCounter,
        weak: cache.weakCounter,
      },
    },

    priority: 10,
  };
}
