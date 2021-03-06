const stacks = stacks => {
    return stacks.map(stack);
};

const stack = stack => {
    return {
        name: stack.Name,
        services: stack.Services.map(service)
    };
};

const service = service => {
    return {
        id: service.ID,
        createdAt: service.CreatedAt,
        name: service.Spec.Name,
        image: service.Spec.TaskTemplate.ContainerSpec.Image,
        username: service.Spec.Labels.name,
        ports: (service.Endpoint && service.Endpoint.Ports ? service.Endpoint.Ports.map(port) : null),
        tasks: service.Tasks.map(task)
    };
};

const port = port => {
    return port.TargetPort;
};

const task = task => {
    return {
        createdAt: task.CreatedAt,
        state: task.Status.State,
        node: node(task.Node)
    };
};

const node = node => {
    return {
        state: node.Status.State,
        addr: node.Status.Addr
    };
};

const stackCreationResult = stackName => {
    return {
        stackName: stackName
    };
};

const stackDeletionResult = wasDeleted => {
    return {
        success: wasDeleted
    };
};

const healthcheckResult = healthy => {
    return {
        healthy
    };
};

const tokenResult = token => {
    return {
        token: token
    };
};

const user = user => {
    return {
        name: user.name,
        type: user.type
    };
};

module.exports = {
    stacks,
    stack,
    service,
    task,
    node,
    stackCreationResult,
    stackDeletionResult,
    healthcheckResult,
    tokenResult,
    user
};