export class BossHelperError extends Error {
  state: 'warning' | 'danger'
  error_type: 'boss-helper'

  constructor(message: string, state: 'warning' | 'danger' = 'warning', options?: ErrorOptions) {
    super(message, options)
    this.state = state
    this.error_type = 'boss-helper'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class UnknownError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '未知错误'
  }
}

export class PublishError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '投递出错'
  }
}

export class GreetError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '打招呼出错'
  }
}

export class LimitError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '达到限制'
  }
}

/**
 * securityId 已经过期、或这条岗位压根没有搜索原始数据。
 * 单独一个类型是因为它**不重试**：同一轮里队列跑一圈回来它还是过期的，
 * 只有用户重新搜索才会签发新的 securityId，重试只是白打一次接口。
 */
export class StaleJobItemError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '需要重新搜索'
  }
}

export class RateLimitError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '操作频繁'
  }
}
