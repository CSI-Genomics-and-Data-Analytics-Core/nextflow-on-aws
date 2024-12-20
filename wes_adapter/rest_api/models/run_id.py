# coding: utf-8

from __future__ import absolute_import
from datetime import date, datetime  # noqa: F401

from typing import List, Dict  # noqa: F401

from rest_api.models.base_model_ import Model
from rest_api import util


class RunId(Model):
    """NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).

    Do not edit the class manually.
    """

    def __init__(self, run_id=None):  # noqa: E501
        """RunId - a model defined in OpenAPI

        :param run_id: The run_id of this RunId.  # noqa: E501
        :type run_id: str
        """
        self.openapi_types = {"run_id": str}

        self.attribute_map = {"run_id": "run_id"}

        self._run_id = run_id

    @classmethod
    def from_dict(cls, dikt) -> "RunId":
        """Returns the dict as a model

        :param dikt: A dict.
        :type: dict
        :return: The RunId of this RunId.  # noqa: E501
        :rtype: RunId
        """
        return util.deserialize_model(dikt, cls)

    @property
    def run_id(self):
        """Gets the run_id of this RunId.

        workflow run ID  # noqa: E501

        :return: The run_id of this RunId.
        :rtype: str
        """
        return self._run_id

    @run_id.setter
    def run_id(self, run_id):
        """Sets the run_id of this RunId.

        workflow run ID  # noqa: E501

        :param run_id: The run_id of this RunId.
        :type run_id: str
        """

        self._run_id = run_id
