import { fromJS, List, Map } from 'immutable'
import isEqual from 'lodash.isequal'

const recentTimeInterval = 10 * 60 * 1000 // ten minutes

/*
 * Returns false if:
 *  - fetchTime is more than 10 minutes ago
 *  - fetchTime is null (hasn't been set yet)
 *  - fetchTime is 0 (but note, this won't return NEEDS_FETCH)
 */
function recent(fetchTime) {
  if (fetchTime === null) return false

  return Date.now() - recentTimeInterval < fetchTime
}

export function selectCollection(modelName, crud, params = {}, opts = {}) {
  const nested = opts.nested || []
  const isLoading = ({ needsFetch }) => ({
    otherInfo: {},
    data: [],
    isLoading: true,
    needsFetch
  })

  const model = crud.getIn([modelName], Map())

  // find the collection that has the same params
  const collection = model.get('collections', List()).find(coll => {
    return isEqual(coll.get('params').toJS(), params)
  })
  if (collection === undefined) {
    return isLoading({ needsFetch: true })
  }

  const fetchTime = collection.get('fetchTime')
  if (fetchTime === 0) {
    return isLoading({ needsFetch: false })
  } else if (!recent(fetchTime)) {
    return isLoading({ needsFetch: true })
  }

  // search the records to ensure they're all recent
  // TODO can we make this faster?
  let itemNeedsFetch = null
  collection.get('ids', fromJS([])).forEach((id) => {
    const item = model.getIn(['byId', id.toString()], Map())
    if (!recent(item.get('fetchTime'))) {
      itemNeedsFetch = item
      return false
    }
  })
  if (itemNeedsFetch) {
    if (itemNeedsFetch.get('fetchTime') === 0) {
      return isLoading({ needsFetch: false })
    }
    return isLoading({ needsFetch: true })
  }

  const dataShallow = collection.get('ids', fromJS([])).map((id) =>
    model.getIn(['byId', id.toString(), 'record'])
  ).toJS()

  const data = dataShallow.map(shallow => {
    let record = Object.assign({}, shallow)
    nested.forEach(nestedModel => {
      const id = record[nestedModel].toString()
      record[nestedModel] = crud.getIn([nestedModel, 'byId', id, 'record'])
    })
    return record
  })

  return {
    otherInfo: collection.get('otherInfo', Map()).toJS(),
    data,
    isLoading: false,
    needsFetch: false
  }
}

export function selectRecord(modelName, id, crud) {
  const id_str = id ? id.toString() : undefined
  const model = crud.getIn([modelName, 'byId', id_str])

  if (model && model.get('fetchTime') === 0) {
    return { isLoading: true, needsFetch: false, error: { message: 'Loading...' } }
  }
  if (id === undefined || model === undefined ||
      !recent(model.get('fetchTime'))) {
    return { isLoading: true, needsFetch: true, error: { message: 'Loading...' } }
  }

  if (model.get('error') !== null) {
    return {
      isLoading: false,
      needsFetch: false,
      error: model.get('error').toJS()
    }
  }
  return model.get('record').toJS()
}

export function selectRecordOrEmptyObject(modelName, id, crud) {
  const record = selectRecord(modelName, id, crud)
  if (record.isLoading || record.error) {
    return {}
  }
  return record
}

export function selectActionStatus(modelName, crud, action) {
  const status = crud.getIn([modelName, 'actionStatus', action]) ||
                 fromJS({
                   pending: false,
                   id: null,
                   isSuccess: null,
                   payload: null
                 })
  return status.toJS()
}

export function selectNiceActionStatus(modelName, crud, action) {
  const { pending, id, isSuccess, payload } = selectActionStatus(modelName, crud, action)

  if (pending === true) {
    return { id, pending }
  }
  if (isSuccess === true) {
    return {
      id,
      response: payload,
      pending
    }
  }
  if (isSuccess === false) {
    return {
      id,
      error: payload,
      pending
    }
  }
  return {}
}
