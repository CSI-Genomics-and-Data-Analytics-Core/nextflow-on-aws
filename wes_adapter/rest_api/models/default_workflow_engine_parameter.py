# coding: utf-8

from __future__ import absolute_import
from datetime import date, datetime  # noqa: F401

from typing import List, Dict  # noqa: F401

from rest_api.models.base_model_ import Model
from rest_api import util


class DefaultWorkflowEngineParameter(Model):
    """NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).

    Do not edit the class manually.
    """

    def __init__(self, name=None, type=None, default_value=None):  # noqa: E501
        """DefaultWorkflowEngineParameter - a model defined in OpenAPI

        :param name: The name of this DefaultWorkflowEngineParameter.  # noqa: E501
        :type name: str
        :param type: The type of this DefaultWorkflowEngineParameter.  # noqa: E501
        :type type: str
        :param default_value: The default_value of this DefaultWorkflowEngineParameter.  # noqa: E501
        :type default_value: str
        """
        self.openapi_types = {"name": str, "type": str, "default_value": str}

        self.attribute_map = {
            "name": "name",
            "type": "type",
            "default_value": "default_value",
        }

        self._name = name
        self._type = type
        self._default_value = default_value

    @classmethod
    def from_dict(cls, dikt) -> "DefaultWorkflowEngineParameter":
        """Returns the dict as a model

        :param dikt: A dict.
        :type: dict
        :return: The DefaultWorkflowEngineParameter of this DefaultWorkflowEngineParameter.  # noqa: E501
        :rtype: DefaultWorkflowEngineParameter
        """
        return util.deserialize_model(dikt, cls)

    @property
    def name(self):
        """Gets the name of this DefaultWorkflowEngineParameter.

        The name of the parameter  # noqa: E501

        :return: The name of this DefaultWorkflowEngineParameter.
        :rtype: str
        """
        return self._name

    @name.setter
    def name(self, name):
        """Sets the name of this DefaultWorkflowEngineParameter.

        The name of the parameter  # noqa: E501

        :param name: The name of this DefaultWorkflowEngineParameter.
        :type name: str
        """

        self._name = name

    @property
    def type(self):
        """Gets the type of this DefaultWorkflowEngineParameter.

        Describes the type of the parameter, e.g. float.  # noqa: E501

        :return: The type of this DefaultWorkflowEngineParameter.
        :rtype: str
        """
        return self._type

    @type.setter
    def type(self, type):
        """Sets the type of this DefaultWorkflowEngineParameter.

        Describes the type of the parameter, e.g. float.  # noqa: E501

        :param type: The type of this DefaultWorkflowEngineParameter.
        :type type: str
        """

        self._type = type

    @property
    def default_value(self):
        """Gets the default_value of this DefaultWorkflowEngineParameter.

        The stringified version of the default parameter. e.g. \"2.45\".  # noqa: E501

        :return: The default_value of this DefaultWorkflowEngineParameter.
        :rtype: str
        """
        return self._default_value

    @default_value.setter
    def default_value(self, default_value):
        """Sets the default_value of this DefaultWorkflowEngineParameter.

        The stringified version of the default parameter. e.g. \"2.45\".  # noqa: E501

        :param default_value: The default_value of this DefaultWorkflowEngineParameter.
        :type default_value: str
        """

        self._default_value = default_value
