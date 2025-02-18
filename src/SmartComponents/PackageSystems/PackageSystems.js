import { Button, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { AnsibeTowerIcon } from '@patternfly/react-icons';
import { TableVariant } from '@patternfly/react-table';
import { InventoryTable } from '@redhat-cloud-services/frontend-components/Inventory';
import propTypes from 'prop-types';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import messages from '../../Messages';
import searchFilter from '../../PresentationalComponents/Filters/SearchFilter';
import statusFilter from '../../PresentationalComponents/Filters/StatusFilter';
import { getStore, register } from '../../store';
import { changePackageSystemsParams, clearPackageSystemsStore, fetchPackageSystemsAction } from '../../store/Actions/Actions';
import { packagesSystemsInventoryReducer } from '../../store/Reducers/InventoryEntitiesReducer';
import { fetchPackageSystems } from '../../Utilities/api';
import { remediationIdentifiers } from '../../Utilities/constants';
import { createPackageSystemsRows } from '../../Utilities/DataMappers';
import { arrayFromObj, buildFilterChips, createSortBy, remediationProvider, filterSelectedRowIDs } from '../../Utilities/Helpers';
import {
    useDeepCompareEffect, useHandleRefresh, useOnSelect, usePagePerPage,
    useRemoveFilter, useSortColumn, useBulkSelectConfig
} from '../../Utilities/Hooks';
import { intl } from '../../Utilities/IntlProvider';
import RemediationModal from '../Remediation/RemediationModal';
import { packageSystemsColumns } from '../Systems/SystemsListAssets';
import ErrorHandler from '../../PresentationalComponents/Snippets/ErrorHandler';

const PackageSystems = ({ packageName }) => {
    const dispatch = useDispatch();
    const enableRemediation = false;
    const [
        RemediationModalCmp,
        setRemediationModalCmp
    ] = React.useState(() => () => null);
    const rawPackageSystems = useSelector(
        ({ PackageSystemsStore }) => PackageSystemsStore.rows
    );
    const status = useSelector(
        ({ PackageSystemsStore }) => PackageSystemsStore.status
    );
    const selectedRows = useSelector(
        ({ PackageSystemsStore }) => PackageSystemsStore.selectedRows
    );
    const hosts = React.useMemo(
        () => createPackageSystemsRows(rawPackageSystems, selectedRows),
        [rawPackageSystems]
    );
    const metadata = useSelector(
        ({ PackageSystemsStore }) => PackageSystemsStore.metadata
    );
    const queryParams = useSelector(
        ({ PackageSystemsStore }) => PackageSystemsStore.queryParams
    );

    const inventoryColumns = useSelector(
        ({ entities }) => entities && entities.columns
    );

    const handleRefresh = useHandleRefresh(metadata, apply);
    const { filter, search } = queryParams;

    React.useEffect(() => {
        return () => dispatch(clearPackageSystemsStore());
    }, []);

    useDeepCompareEffect(() => {
        dispatch(
            fetchPackageSystemsAction({ id: packageName, ...queryParams })
        );
    }, [queryParams]);

    const [page, perPage] = usePagePerPage(metadata.limit, metadata.offset);

    function apply(params) {
        dispatch(changePackageSystemsParams(params));
    }

    const [deleteFilters] = useRemoveFilter(filter, apply);

    const filterConfig = {
        items: [
            searchFilter(apply, search,
                intl.formatMessage(messages.labelsFiltersSystemsSearchTitle),
                intl.formatMessage(messages.labelsFiltersSystemsSearchPlaceholder)
            ),
            statusFilter(apply, filter)
        ]
    };

    const activeFiltersConfig = {
        filters: buildFilterChips(filter, search),
        onDelete: deleteFilters
    };

    const showRemediationModal = data => {
        setRemediationModalCmp(() => () => <RemediationModal data={data} />);
    };

    const constructFilename = (system) => {
        return `${packageName}-${system.available_evra}`;
    };

    const fetchAllData = () =>
        fetchPackageSystems({ id: packageName, limit: 999999 });

    const selectRows = (toSelect) => {
        dispatch({ type: 'SELECT_ENTITY', payload: toSelect });
    };

    const onSelect = enableRemediation && useOnSelect(rawPackageSystems,  selectedRows,
        fetchAllData, selectRows, constructFilename);

    // This is used ONLY for sorting purposes
    const getMangledColumns = () => {
        let updated = inventoryColumns && inventoryColumns.filter(({ key }) => key === 'updated')[0];
        updated = { ...updated, key: 'last_upload' };
        return [...packageSystemsColumns, updated];
    };

    const onSort = useSortColumn(getMangledColumns(), apply, 0);
    const sortBy = React.useMemo(
        () => createSortBy(getMangledColumns(), metadata.sort, 0),
        [metadata.sort]
    );

    const selectedCount = selectedRows && arrayFromObj(selectedRows).length;

    return (
        <React.Fragment>
            {status.hasError && <ErrorHandler code={status.code} /> || (
                <InventoryTable
                    disableDefaultColumns
                    onLoad={({ mergeWithEntities }) => {
                        const store = getStore();
                        register({
                            ...mergeWithEntities(
                                packagesSystemsInventoryReducer(packageSystemsColumns, store.getState().PackageSystemsStore)
                            )
                        });

                    }}
                    items={hosts}
                    page={page}
                    total={metadata.total_items}
                    perPage={perPage}
                    onRefresh={handleRefresh}
                    isLoaded={!status.isLoading}
                    tableProps = {{ canSelectAll: false,
                        onSort: metadata.total_items && onSort,
                        sortBy: metadata.total_items && sortBy,
                        onSelect, variant: TableVariant.compact, className: 'patchCompactInventory', isStickyHeader: true }}
                    filterConfig={filterConfig}
                    activeFiltersConfig = {activeFiltersConfig}
                    bulkSelect={enableRemediation && onSelect && useBulkSelectConfig(selectedCount, onSelect, metadata, hosts)}
                >
                    {enableRemediation &&
                    <ToolbarGroup>
                        <ToolbarItem>
                            <Button
                                className={'remediationButtonPatch'}
                                isDisabled={
                                    arrayFromObj(selectedRows).length === 0
                                }
                                onClick={() =>
                                    showRemediationModal(
                                        remediationProvider(
                                            packageName,
                                            filterSelectedRowIDs(selectedRows),
                                            remediationIdentifiers.package
                                        )
                                    )
                                }
                                ouiaId={'toolbar-remediation-button'}
                            >
                                <AnsibeTowerIcon/>&nbsp;{intl.formatMessage(messages.labelsRemediate)}
                            </Button>
                            <RemediationModalCmp />
                        </ToolbarItem>
                    </ToolbarGroup>
                    }
                </InventoryTable>
            )}
        </React.Fragment>
    );
};

PackageSystems.propTypes = {
    packageName: propTypes.string
};

export default PackageSystems;
