import { FETCH, FETCH_ONE, FETCH_ONE_SUCCESS } from './actionTypes'

function trimModelFromRecord(model, record) {
  if (!(model in record)) {
    return {
      trimmedRecord: record,
      nestedRecord: null
    }
  }

  const nestedRecord = record[model]
  let trimmedRecord = Object.assign({}, record)
  trimmedRecord[model] = nestedRecord.id
  return {
    trimmedRecord,
    nestedRecord
  }
}

function getModifiedDataAndActions(dataArray) {
  let modifiedData = Object.assign({}, dataArray)

  const nestedRecords = {}
  dataArray.forEach((_record, index) => {
    nested.forEach(model => {
      const record = modifiedData[index]
      const { trimmedRecord, nestedRecord } = trimModelFromRecord(model, record)
      nestedRecords[model] = nestedRecords[model] || {}
      nestedRecords[model][nestedRecord.id] = nestedRecord
      modifiedData[index] = trimmedRecord
    })
  })

  const actions = []
  Object.keys(newNestedRecords).map(key => {
    const byId = newNestedRecords[key]
    Object.keys(byId).map(id => {
      actions.push({ 
        meta: { model: key, id: _.parseInt(id) },
        type: FETCH_ONE_SUCCESS,
        payload: byId[id]
      })
    })
  })

  return {
    actions,
    modifiedData
  }
}

export default function prepareActionsFromResponse(response, action) {
  // emulate old behaviour for non-fetch actions or those without nesting specified
  const { nested } = action.meta
  const { success } = action.meta

  if ([FETCH, FETCH_ONE].indexOf(action.type) === -1 ||
      nested.length === 0) {
    return [
      { ...action, type: success, payload: response }
    ]
  }

  switch(action.type) {
    case FETCH_ONE:
      const { actions, modifiedData } = getModifiedDataAndActions([response])
      actions.push({
        ...action,
        type: success,
        payload: modifiedData[0]
      })
      return actions
    case FETCH:
      const { actions, modifiedData } = getModifiedDataAndActions(response.data)
      actions.push({
        ...action,
        type: success,
        payload: {
          ...response,
          data: modifiedData
        }
      })
      return actions
  }
  throw new Error("Invalid action.type in prepareActionsFromResponse")
}
