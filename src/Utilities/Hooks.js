import { SortByDirection } from '@patternfly/react-table/dist/js';
import isDeepEqualReact from 'fast-deep-equal/react';
import React from 'react';
import { compoundSortValues } from './constants';
import { convertLimitOffset, getLimitFromPageSize, getOffsetFromPageLimit, createSystemsSortBy } from './Helpers';
import { intl } from './IntlProvider';
import messages from '../Messages';

export const useSetPage = (limit, callback) => {
    const onSetPage = React.useCallback((_, page) =>
        callback({ offset: getOffsetFromPageLimit(page, limit) })
    );
    return onSetPage;
};

export const useHandleRefresh = (metadata, callback) => {
    const handleRefresh = React.useCallback(({ page, per_page: perPage }) => {
        const offset = getOffsetFromPageLimit(page, perPage);
        const limit = getLimitFromPageSize(perPage);
        (metadata.offset !== offset || metadata.limit !== limit) &&
            callback({
                ...(metadata.offset !== offset && { offset }),
                ...(metadata.limit !== limit && { limit })
            });
    });
    return handleRefresh;
};

export const usePagePerPage = (limit, offset) => {
    const [page, perPage] = React.useMemo(
        () => convertLimitOffset(limit, offset),
        [limit, offset]
    );
    return [page, perPage];
};

export const usePerPageSelect = callback => {
    const onPerPageSelect = React.useCallback((_, perPage) =>
        callback({ limit: getLimitFromPageSize(perPage), offset: 0 })
    );
    return onPerPageSelect;
};

export const useSortColumn = (columns, callback, offset = 0) => {
    const onSort = React.useCallback((_, index, direction) => {
        let columnName = columns[index - offset].key;
        const compoundKey = compoundSortValues[columnName];
        if (compoundKey) {
            columnName = compoundKey[direction];
        }
        else if (direction === SortByDirection.desc) {
            columnName = '-' + columnName;
        }

        callback({ sort: columnName });
    });
    return onSort;
};

export const useRemoveFilter = (filters, callback, defaultFilters = { filter: {} }) => {
    const removeFilter = React.useCallback((event, selected, resetFilters) => {
        let newParams = { filter: {} };
        selected.forEach(selectedItem => {
            let { id: categoryId, chips } = selectedItem;
            if (categoryId !== 'search') {
                let activeFilter = filters[categoryId];
                const toRemove = chips.map(item => item.id.toString());
                if (Array.isArray(activeFilter)) {
                    newParams.filter[categoryId] = activeFilter.filter(
                        item => !toRemove.includes(item.toString())
                    );
                } else {
                    newParams.filter[categoryId] = '';
                }
            } else {
                newParams.search = '';
            }

        });

        if (resetFilters) {
            newParams =  resetFilters(newParams);
        }

        callback({ ...newParams });
    });

    const deleteFilterGroup = (__, filters) => {
        removeFilter(__, filters);
    };

    const deleteFilters = (__, selected) => {
        const resetFilters = (currentFilters) => {
            if (Object.keys(defaultFilters.filter).length > 0)
            {
                currentFilters.filter = { ...currentFilters.filter, ...defaultFilters.filter };
            }

            return currentFilters;
        };

        removeFilter(__, selected, resetFilters);
    };

    return [deleteFilters, deleteFilterGroup];
};

export const useOnSelect = (rawData, selectedRows, fetchAllData, selectRows,
    constructFilename = undefined, transformKey = undefined) =>{
    const constructKey = (row) => {
        if (transformKey) {
            return transformKey(row);
        }
        else {
            return row.id || row.name;
        }
    };

    const onSelect =  React.useCallback((event, selected, rowId) => {
        const createSelectedRow = (rawData, toSelect = []) => {
            rawData.forEach((row)=>{
                toSelect.push(
                    {
                        id: constructKey(row),
                        selected: constructFilename && constructFilename(row) || row.id
                    }
                );});

            return toSelect;
        };

        switch (event) {
            case 'none': {
                const toSelect = [];
                Object.keys(selectedRows).forEach(id=>{
                    toSelect.push(
                        {
                            id,
                            selected: false
                        }
                    );
                });
                selectRows(toSelect);
                break;
            }

            case 'page': {
                if (Array.isArray(rawData)) {
                    rawData = rawData.filter(row => !row.disableCheckbox);
                }

                selectRows(createSelectedRow(rawData));
                break;
            }

            case 'all': {
                const fetchCallback = ({ data }) => {
                    selectRows(createSelectedRow(data));
                };

                fetchAllData().then(fetchCallback);

                break;
            }

            default: {
                selectRows([{
                    id: constructKey(rawData[rowId]),
                    selected: selected && (constructFilename && constructFilename(rawData[rowId]) || true)
                }]);
            }

        }}
    );

    return onSelect;
};

export const setPageTitle = (title) => {
    React.useEffect(() => {
        if (title) {
            document.title = `${title} - Patch | Red Hat Insights`;
        }
    }, [title]);
};

export const useDeepCompareEffect = (effect, deps) => {
    const ref = React.useRef(undefined);

    if (!ref.current || !isDeepEqualReact(deps, ref.current)) {
        ref.current = deps;
    }

    React.useEffect(effect, ref.current);
};

export const useBulkSelectConfig = (selectedCount, onSelect, metadata, rows, onCollapse) => ({
    count: selectedCount,
    items: [{
        title: intl.formatMessage(messages.labelsBulkSelectNone),
        onClick: () => {
            onSelect('none');
        }
    }, {
        title: intl.formatMessage(messages.labelsBulkSelectPage,
            { count: onCollapse && rows.length / 2 || rows.length }
        ),
        onClick: () => {
            onSelect('page');
        }
    },
    {
        title: intl.formatMessage(messages.labelsBulkSelectAll, { count: metadata.total_items }),
        onClick: () => {
            onSelect('all');
        }
    }],
    onSelect: () => {
        selectedCount === 0 ? onSelect('all') : onSelect('none');
    },
    toggleProps: {
        'data-ouia-component-type': 'bulk-select-toggle-button'
    },
    checked: selectedCount === 0 ? false : selectedCount === metadata.total_items ? true : null,
    isDisabled: metadata.total_items === 0 && selectedCount === 0
});

export const useGetEntities = (fetchApi, apply, id) => {
    const getEntities = async (
        _items,
        { orderBy, orderDirection, page, per_page: perPage, patchParams }
    ) => {

        const sort = createSystemsSortBy(orderBy, orderDirection);

        const items = await fetchApi({
            page,
            per_page: perPage,
            ...patchParams,
            sort,
            ...id && { id } || {}
        });

        apply({
            page,
            per_page: perPage,
            sort
        });

        return {
            results: items.data.map(row => ({ id: row.id, ...row.attributes })),
            total: items.meta?.total_items
        };
    };

    return getEntities;
};
