import dissocpath from '@ramda/dissocpath';

// well https://github.com/lodash/lodash/issues/723

export function omitDeep(excludeKeys: (string | number)[], collection: any) {
    return dissocpath(excludeKeys, collection);
}
